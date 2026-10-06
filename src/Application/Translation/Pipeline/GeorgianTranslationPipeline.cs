using System.Diagnostics;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Common.Extensions;
using Application.Common.Interfaces.TranslationService;
using Application.Translation.Cache;
using Application.Translation.Languages;
using Application.Verbs;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Application.Translation.Pipeline;

/// <summary>
/// Translation of a Georgian / Russian word or phrase. "First look for what is already there, only then
/// ask a model; what a model said once is stored and never asked again" — each request goes down this
/// ladder and stops at the first step that answers (the user's own dictionary is checked before it, in
/// <c>TranslateAndCreateVocabularyEntry</c>):
/// <list type="number">
/// <item>the verb base, no model and no key needed: an exact Georgian form or masdar, a Russian gloss,
///   or a Russian verb form matched by the plain-Russian meanings stored with every catalog form;</item>
/// <item>the translation cache — a text that was looked up before, or a remembered verdict about it;</item>
/// <item>the classifier (cheap model, one call): is the text something to translate at all, is it a
///   verb, and for a Russian verb — its infinitive, which is tried against the verb base again;</item>
/// <item>for a verb that is still unknown — the analyst (stronger model with the Wiktionary tool), then
///   <see cref="VerbProposalResolver"/> validates and stores the verb, so the next request stops at step 1 or 2;</item>
/// <item>everything else — the translator that was here before (<see cref="GeorgianTranslationModule"/>:
///   dictionary site, then Google), and its answer goes to the cache.</item>
/// </list>
/// Steps 3 and 4 run only when the agent path is on (<see cref="ITranslationAgentSwitch"/>). Any failure
/// of a model or tool step — no key, quota, timeout, malformed output — falls through to step 5, so the
/// user gets what they would have got without the models.
/// </summary>
public class GeorgianTranslationPipeline(
    GeorgianTranslationModule legacy,
    IParsingUniversalTranslator dictionarySite,
    TranslationCache cache,
    VerbBaseSearch verbBase,
    IVerbLexicon lexicon,
    ITranslationAgentSwitch agentSwitch,
    ModelBudget budget,
    ITranslationRequestClassifier classifier,
    IVerbAnalyst analyst,
    VerbProposalResolver resolver,
    ITraleDbContext dbContext,
    IOptions<TranslationAgentOptions> options,
    ILogger<GeorgianTranslationPipeline> logger) : ITranslationModule
{
    /// <summary>A verb with a pronoun or a particle at most; longer texts are phrases for the plain translator.</summary>
    private const int MaxWordsForVerbAnalysis = 3;

    public Language GetLanguage() => Language.Georgian;

    /// <summary>What one request did, for its log line.</summary>
    private sealed class Trace
    {
        public List<string> Steps { get; } = [];
        public ModelUsage Classifier { get; set; } = ModelUsage.None;
        public ModelUsage Analyst { get; set; } = ModelUsage.None;
    }

    public async Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct)
    {
        var stopwatch = Stopwatch.StartNew();
        var trace = new Trace();
        var result = await Run(wordToTranslate, trace, ct);

        // One line per request: which steps ran, what the models cost and how long it all took. The
        // looked-up text is the only user input in it.
        logger.LogInformation(
            "Translation of {Word}: path {Path}, {Outcome}, {ElapsedMs} ms, model calls {ModelCalls} (classifier {ClassifierUsage}, analyst {AnalystUsage})",
            wordToTranslate, string.Join(">", trace.Steps), result.GetType().Name, stopwatch.ElapsedMilliseconds,
            trace.Classifier.Calls + trace.Analyst.Calls, Tokens(trace.Classifier), Tokens(trace.Analyst));
        return result;
    }

    /// <summary>calls×input/output tokens, e.g. 2x1830/212.</summary>
    private static string Tokens(ModelUsage usage) => $"{usage.Calls}x{usage.InputTokens}/{usage.OutputTokens}";

    private async Task<TranslationResult> Run(string word, Trace trace, CancellationToken ct)
    {
        var key = TranslationCacheKey.Normalize(word);
        if (key == null)
        {
            trace.Steps.Add("legacy");
            return await legacy.Translate(word, ct);
        }

        var isRussian = key.DetectLanguage() == Language.Russian;
        var direction = isRussian ? TranslationDirection.RussianToGeorgian : TranslationDirection.GeorgianToRussian;

        // 1. The verb base.
        var fromBase = await AnswerFromVerbBase(key, isRussian, ct);
        if (fromBase != null)
        {
            trace.Steps.Add("verb-base");
            return fromBase;
        }

        // 2. The cache.
        var agentOn = agentSwitch.IsOn;
        var cached = await cache.FindAsync(key, direction, ct);
        if (cached is { Source: TranslationCache.SourceNotTranslatable })
        {
            trace.Steps.Add("cache");
            await cache.RecordHitAsync(cached, classified: true, ct);
            return new TranslationResult.NotTranslatable();
        }

        // An entry cached while the agent was off has never been looked at by the classifier: it may
        // be a verb. It takes the agent path once; after that the flag (or the stored verb) answers.
        var settled = cached?.Classified ?? false;
        var translation = cached != null && TranslationCache.HasTranslation(cached) ? cached : null;
        if (translation != null && (!agentOn || settled))
        {
            trace.Steps.Add("cache");
            return await ServeCached(translation, settled, ct);
        }

        // 3 and 4. The models — unless the open lexicon alone names the verb and the source has its table.
        if (agentOn && !settled && CanBeVerb(key))
        {
            var bySource = await TryResolveBySource(Ask(key, isRussian, []), key, direction, cached, trace, ct);
            if (bySource != null)
            {
                return bySource;
            }
        }

        if (agentOn && !settled && !budget.TrySpend())
        {
            trace.Steps.Add("over-daily-budget");
        }
        else if (agentOn && !settled)
        {
            var (answer, isSettled) = await AskModels(key, isRussian, direction, cached, trace, ct);
            settled = isSettled;
            if (answer != null)
            {
                return answer;
            }
        }

        // 5. The translator that was here before.
        if (translation != null)
        {
            trace.Steps.Add("cache");
            return await ServeCached(translation, settled, ct);
        }

        trace.Steps.Add("legacy");
        var translated = await legacy.Translate(word, ct);
        if (translated is TranslationResult.Success success)
        {
            await cache.StoreAsync(key, direction, success, TranslationCache.SourceExternal, settled, ct, replace: cached);
        }
        else if (settled && cached == null)
        {
            // Nothing to cache, but the models' verdict is worth keeping: the next request for this text
            // goes straight to the translator.
            await cache.StoreVerdictAsync(key, direction, TranslationCache.SourceNoTranslation, ct);
        }

        return translated;
    }

    /// <summary>
    /// Steps 3 and 4. <c>Settled</c> tells whether the question "do the models have anything to say
    /// about this text" got a final answer: yes after a clean verdict or a rejected proposal, no after
    /// a timeout or an error — then the text is asked about again next time instead of being written off.
    /// </summary>
    private async Task<(TranslationResult? Answer, bool Settled)> AskModels(
        string key, bool isRussian, TranslationDirection direction, TranslationCacheEntry? cached, Trace trace, CancellationToken ct)
    {
        TranslationClassification classification;
        try
        {
            using var timeout = Timeout(options.Value.ClassifierTimeoutSeconds, ct);
            classification = await classifier.ClassifyAsync(key, timeout.Token);
            trace.Classifier += classification.Usage ?? ModelUsage.None;
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Steps.Add("classifier-failed");
            logger.LogWarning("Translation classifier failed: {Error}", Describe(e));
            return (null, false);
        }

        if (classification.NotTranslatable)
        {
            return await ConfirmNotTranslatable(key, direction, cached, trace, ct);
        }

        if (!classification.IsVerb || !CanBeVerb(key))
        {
            trace.Steps.Add("not-a-verb");
            return IsUnseenGeorgianWord(key)
                ? await ConfirmNotTranslatable(key, direction, cached, trace, ct)
                : (null, true);
        }

        var question = key;
        if (isRussian)
        {
            // The classifier names the dictionary form of a Russian verb — the verb base knows verbs by it.
            var infinitive = TranslationCacheKey.Normalize(classification.RussianInfinitive);
            if (infinitive != null && infinitive != key && infinitive.DetectLanguage() == Language.Russian)
            {
                question = infinitive;
                var known = await verbBase.FindExactAsync(infinitive, ct);
                if (known != null)
                {
                    trace.Steps.Add("verb-base-by-infinitive");
                    var answer = await AnswerFromVerb(key, direction, known, infinitive, ct);
                    await cache.StoreAsync(key, direction, answer, TranslationCache.SourceVerbAgent, classified: true, ct, replace: cached);
                    return (answer, true);
                }
            }
        }

        try
        {
            using var timeout = Timeout(options.Value.AnalystTimeoutSeconds, ct);
            var typos = isRussian ? [] : await verbBase.SearchAsync(key, timeout.Token);
            var asked = Ask(question, isRussian, typos);
            if (question != key)
            {
                // The infinitive is new information: the lexicon may name its verb without the analyst.
                var bySource = await TryResolveBySource(asked, key, direction, cached, trace, ct);
                if (bySource != null)
                {
                    return (bySource, true);
                }
            }

            var analysis = await analyst.AnalyzeAsync(asked, timeout.Token);
            trace.Analyst += analysis.Usage ?? ModelUsage.None;
            trace.Steps.Add($"analyst[{string.Join(" ", analysis.ToolCalls ?? [])}]");
            var resolution = await resolver.ResolveAsync(asked, analysis, timeout.Token, ct);
            if (resolution is { Verb: null, RetryHint: not null })
            {
                // One retry, with the concrete discrepancy the checks found. Never a second one.
                trace.Steps.Add($"retry({resolution.Rejection})");
                asked = asked with { Feedback = resolution.RetryHint };
                analysis = await analyst.AnalyzeAsync(asked, timeout.Token);
                trace.Analyst += analysis.Usage ?? ModelUsage.None;
                trace.Steps.Add($"analyst[{string.Join(" ", analysis.ToolCalls ?? [])}]");
                resolution = await resolver.ResolveAsync(asked, analysis, timeout.Token, ct);
            }

            if (resolution.Verb == null)
            {
                trace.Steps.Add($"verb-rejected({resolution.Rejection})");
                // The analyst knows no such verb. If no dictionary does either, machine translation
                // would only invent something to save into the user's dictionary.
                return analysis.Proposal.Outcome == VerbProposalOutcome.None || IsUnseenGeorgianWord(key)
                    ? await ConfirmNotTranslatable(key, direction, cached, trace, ct)
                    : (null, true);
            }

            trace.Steps.Add($"verb-{resolution.Verb.Path}");
            return (await AnswerAndRemember(resolution.Verb, key, question, direction, cached, ct), true);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Steps.Add("analyst-failed");
            logger.LogWarning("Verb analyst failed: {Error}", Describe(e));
            return (null, false);
        }
    }

    /// <summary>The agents know two languages, and a verb is a word or two; a phrase is for the plain translator.</summary>
    private static bool CanBeVerb(string key) =>
        !key.Any(char.IsAsciiLetter) && key.Split(' ').Length <= MaxWordsForVerbAnalysis;

    /// <summary>
    /// One Georgian word that never occurs in the corpora of real texts: most likely not a word. On its
    /// own this proves nothing (rare words exist) — it only sends the text to the dictionary-site check
    /// before machine translation gets it.
    /// </summary>
    private bool IsUnseenGeorgianWord(string key) =>
        lexicon.HasAttestedForms && VerbParadigm.GeorgianWord.IsMatch(key) && !lexicon.IsAttested(key)
        && lexicon.Find(key).Count == 0;

    private VerbQuestion Ask(string text, bool isRussian, IReadOnlyList<VerbBaseMatch> typos) =>
        new(text, isRussian, typos, isRussian ? lexicon.FindByRussian(text) : lexicon.Find(text));

    /// <summary>
    /// No model at all: the open lexicon names exactly one verb for the text (a Russian infinitive it
    /// translates, a Georgian lemma or verbal noun), the source has its conjugation table, and — for a
    /// Georgian text — its Russian gloss. The same resolver checks and stores it.
    /// </summary>
    private async Task<TranslationResult?> TryResolveBySource(
        VerbQuestion asked, string key, TranslationDirection direction, TranslationCacheEntry? cached, Trace trace, CancellationToken ct)
    {
        if (asked.Lexicon is not [{ HasTable: true } only] || (!asked.IsRussian && only.Russian.Count == 0))
        {
            return null;
        }

        try
        {
            using var timeout = Timeout(options.Value.AnalystTimeoutSeconds, ct);
            var proposal = new VerbAnalystResult(
                new VerbProposal(VerbProposalOutcome.Wiktionary, only.Lemma), new Dictionary<string, WiktionaryVerbPage?>());
            var resolution = await resolver.ResolveAsync(asked, proposal, timeout.Token, ct);
            if (resolution.Verb == null)
            {
                trace.Steps.Add($"lexicon-rejected({resolution.Rejection})");
                return null;
            }

            trace.Steps.Add($"lexicon>verb-{resolution.Verb.Path}");
            return await AnswerAndRemember(resolution.Verb, key, asked.Text, direction, cached, ct);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Steps.Add("lexicon-failed");
            logger.LogWarning("Lexicon route failed: {Error}", Describe(e));
            return null;
        }
    }

    private async Task<TranslationResult> AnswerAndRemember(
        ResolvedVerb verb, string key, string question, TranslationDirection direction, TranslationCacheEntry? cached, CancellationToken ct)
    {
        var match = new VerbBaseMatch(
            verb.Verb.Lemma, verb.Verb.Title, verb.Verb.Translation, verb.Verb.Status, "agent", verb.Form);
        var answer = await AnswerFromVerb(key, direction, match, question == key ? null : question, ct);
        // The text itself may not be a form of the verb (a Russian inflected word, a typo): then step 1
        // will not find it next time — the cache will.
        if (await AnswerFromVerbBase(key, direction == TranslationDirection.RussianToGeorgian, ct) == null)
        {
            await cache.StoreAsync(key, direction, answer, TranslationCache.SourceVerbAgent, classified: true, ct, replace: cached);
        }

        return answer;
    }

    /// <summary>
    /// A small model alone must not be able to refuse a real word. Its "not something to translate" is
    /// accepted only when the dictionary site does not know the text either; then nothing is sent to
    /// machine translation (which "translates" any string) and the verdict is remembered.
    /// </summary>
    private async Task<(TranslationResult? Answer, bool Settled)> ConfirmNotTranslatable(
        string key, TranslationDirection direction, TranslationCacheEntry? cached, Trace trace, CancellationToken ct)
    {
        try
        {
            if (await dictionarySite.TranslateAsync(key, Language.Georgian, ct) is TranslationResult.Success)
            {
                trace.Steps.Add("not-translatable-but-in-dictionary");
                return (null, true);
            }
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            // The site is down: no second opinion, so the text is translated as before.
            trace.Steps.Add("not-translatable-unconfirmed");
            logger.LogWarning("Dictionary site failed while confirming a verdict: {Error}", Describe(e));
            return (null, false);
        }

        trace.Steps.Add("not-translatable");
        // A translation cached earlier for this text did not come from the dictionary site (it does not
        // know the text), so it was machine translation of a non-word: the verdict replaces it.
        await cache.StoreVerdictAsync(key, direction, TranslationCache.SourceNotTranslatable, ct, replace: cached);

        return (new TranslationResult.NotTranslatable(), true);
    }

    private async Task<TranslationResult> ServeCached(TranslationCacheEntry entry, bool classified, CancellationToken ct)
    {
        await cache.RecordHitAsync(entry, classified, ct);
        return new TranslationResult.Success(entry.Definition, entry.AdditionalInfo, entry.Example);
    }

    /// <summary>Step 1: the verb base — a Georgian form or masdar, a Russian gloss, a Russian form.</summary>
    private async Task<TranslationResult.Success?> AnswerFromVerbBase(string key, bool isRussian, CancellationToken ct)
    {
        var direction = isRussian ? TranslationDirection.RussianToGeorgian : TranslationDirection.GeorgianToRussian;
        var readings = await verbBase.FindAllExactAsync(key, ct);
        if (readings.Count == 0)
        {
            return null;
        }

        var first = readings[0];
        if (first.Match != "meaning")
        {
            return await AnswerFromVerb(key, direction, first, null, ct);
        }

        // «ходил» can be several cells of one verb. The first reading is the answer; the others are
        // named next to it, each with the note that tells it apart («один раз · сделано»).
        var others = readings.Skip(1)
            .Where(r => r.Form != first.Form)
            .Select(r => r.MeaningNote == null ? r.Form! : $"{r.Form} ({r.MeaningNote})")
            .Distinct()
            .ToList();
        var notes = $"«{first.Meaning}»" + (first.MeaningNote == null ? string.Empty : $" ({first.MeaningNote})")
                    + (others.Count == 0 ? string.Empty : $"; ещё: {string.Join(", ", others)}");
        return new TranslationResult.Success(first.Form!, notes + Transcription(first.Form!), await ExampleFor(first.Lemma, first.Form, ct));
    }

    /// <summary>
    /// The answer for a text that is a verb of the base. Every Georgian word in it comes from the
    /// stored verb. The parse line is not part of the translation — the bot and the mini-app add it
    /// from the form index.
    /// </summary>
    /// <param name="infinitive">The dictionary form of a Russian inflected word, when that is how the verb was found.</param>
    private async Task<TranslationResult.Success> AnswerFromVerb(
        string key, TranslationDirection direction, VerbBaseMatch verb, string? infinitive, CancellationToken ct)
    {
        if (direction == TranslationDirection.RussianToGeorgian)
        {
            // Asked by the Russian infinitive, the answer is the dictionary form of the verb (the lemma is
            // a real form in the index, so the reply gets its parse line and the dictionary entry opens
            // the verb view); the name of the action is added next to it. An inflected word the base has
            // no phrase for gets the same, with the verb it was read as.
            var georgian = verb.Form ?? verb.Lemma;
            string?[] parts =
            [
                infinitive == null ? null : $"это глагол «{infinitive}»",
                verb.Form == null && verb.Title != verb.Lemma ? $"название действия: {verb.Title}" : null
            ];
            return new TranslationResult.Success(
                georgian, string.Join("; ", parts.Where(p => p != null)) + Transcription(georgian), await ExampleFor(verb.Lemma, georgian, ct));
        }

        // The text is Georgian but not itself a form: the analyst read it as a misspelled one.
        var typo = verb.Form != null && !key.Split(' ').Contains(verb.Form) ? $"возможно, это форма {verb.Form}; " : string.Empty;
        if (verb.Meaning == null)
        {
            return new TranslationResult.Success(
                verb.Translation, typo.TrimEnd(' ', ';') + Transcription(key), await ExampleFor(verb.Lemma, verb.Form, ct));
        }

        // A form of the base is translated as what it says — «мы писали», not the infinitive.
        var note = verb.MeaningNote == null ? string.Empty : $" ({verb.MeaningNote})";
        return new TranslationResult.Success(
            verb.Meaning,
            $"{typo}глагол «{verb.Translation}»{note}" + Transcription(key),
            await ExampleFor(verb.Lemma, verb.Form, ct));
    }

    /// <summary>Same line the old translator appends, so the reply looks the same whichever step answered.</summary>
    private static string Transcription(string georgian) =>
        $"\nТранскрипция: [{GeorgianTranscriptionExtension.GetTranscription(georgian)}]";

    /// <summary>A real sentence with this form from the verb card (catalog verbs have them), or nothing.</summary>
    private async Task<string> ExampleFor(string lemma, string? form, CancellationToken ct)
    {
        if (form == null)
        {
            return string.Empty;
        }

        var card = await dbContext.Verbs.AsNoTracking().Where(v => v.Lemma == lemma).Select(v => v.CardJson).FirstOrDefaultAsync(ct);
        var sentence = card == null
            ? null
            : JsonNode.Parse(card)?["sentences"]?.AsArray().FirstOrDefault(s => s?["form"]?.GetValue<string>() == form);
        return sentence == null ? string.Empty : $"{sentence["ka"]} — {sentence["ru"]}";
    }

    /// <summary>
    /// What goes to the log about a failed step: the kind of failure, and the message only when it is
    /// our own (<see cref="TranslationAgentException"/>). A provider's raw message can quote the
    /// request, credentials included, and does not belong in a log.
    /// </summary>
    private static string Describe(Exception e) =>
        e is TranslationAgentException ? e.Message : e is OperationCanceledException ? "timeout" : e.GetType().Name;

    private static CancellationTokenSource Timeout(int seconds, CancellationToken ct)
    {
        var source = CancellationTokenSource.CreateLinkedTokenSource(ct);
        source.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, seconds)));
        return source;
    }
}
