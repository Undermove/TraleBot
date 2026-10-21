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
/// <item>the content check (<see cref="IContentGuard"/>): a text the app does not translate at all is
///   answered "not something to translate" and remembered; when the check is not available or fails,
///   the text goes on;</item>
/// <item>the classifier (cheap model, one call): is the text something to translate at all, is it a
///   verb, and for a Russian verb — its infinitive, which is tried against the verb base again;</item>
/// <item>for a verb that is still unknown — the analyst (the cheap agent with the Wiktionary tool): a
///   verb the source has a table for is stored from the table by <see cref="VerbProposalResolver"/>;</item>
/// <item>for a verb with no table anywhere — <see cref="VerbGenerationService"/>: a strong model writes
///   the record, a second model approves it, it is stored; the next request stops at step 1 or 2;</item>
/// <item>a word or a short phrase that is not a verb — the word translator (<see cref="IWordTranslator"/>):
///   a model gives the everyday translation, with the dictionary site's entries as a hint, and the
///   dictionary confirms the Georgian word exists. A confirmed answer is cached; one the dictionary
///   cannot confirm either way is served with a note and not cached; one the dictionary contradicts
///   (it knows the text, but not the word the model gave, even after one retry) is dropped;</item>
/// <item>everything else — the translator that was here before (<see cref="GeorgianTranslationModule"/>:
///   dictionary site, then Google). Its answer is not cached — nobody has checked it; only the
///   models' verdict "not a verb" is, so they are not asked about the same text twice.</item>
/// </list>
/// The model steps run only when the agent path is on (<see cref="ITranslationAgentSwitch"/>). Any failure
/// of a model or tool step — no key, quota, timeout, malformed output — falls through to the last step,
/// so the user gets what they would have got without the models.
/// <para>
/// The verb models are for verbs only; a noun, an adjective or a short phrase goes to the word
/// translator, and when it has no confirmed answer, to the translator that was here before, unchanged.
/// A text of more than three words is a sentence and reaches no model at all.
/// "Not something to translate" is answered only for a single token the classifier is sure is not a
/// word (or, for a verb-looking one, the strong model is) AND the dictionary site does not know either;
/// a phrase of several words is never refused, and any doubt is translated the old way.
/// </para>
/// </summary>
public class GeorgianTranslationPipeline(
    GeorgianTranslationModule legacy,
    IParsingUniversalTranslator dictionarySite,
    TranslationCache cache,
    VerbBaseSearch verbBase,
    IVerbLexicon lexicon,
    ITranslationAgentSwitch agentSwitch,
    ModelBudget budget,
    TranslationRequester requester,
    ITranslationRequestClassifier classifier,
    IVerbAnalyst analyst,
    VerbProposalResolver resolver,
    VerbGenerationService generation,
    IVerbGenerationSwitch generationSwitch,
    IWordTranslator wordTranslator,
    IDictionaryLookup dictionary,
    IContentGuard contentGuard,
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
        public ModelUsage Generator { get; set; } = ModelUsage.None;
        public ModelUsage Reviewer { get; set; } = ModelUsage.None;
        public ModelUsage Translator { get; set; } = ModelUsage.None;
        public ModelUsage Guard { get; set; } = ModelUsage.None;
    }

    public async Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct)
    {
        var stopwatch = Stopwatch.StartNew();
        var trace = new Trace();
        var result = await Run(wordToTranslate, trace, ct);

        // One line per request: which steps ran, what the models cost and how long it all took. The
        // looked-up text is the only user input in it.
        logger.LogInformation(
            "Translation of {Word}: path {Path}, {Outcome}, {ElapsedMs} ms, model calls {ModelCalls} (classifier {ClassifierUsage}, analyst {AnalystUsage}, generator {GeneratorUsage}, reviewer {ReviewerUsage}, translator {TranslatorUsage}, guard {GuardUsage})",
            wordToTranslate, string.Join(">", trace.Steps), result.GetType().Name, stopwatch.ElapsedMilliseconds,
            trace.Classifier.Calls + trace.Analyst.Calls + trace.Generator.Calls + trace.Reviewer.Calls + trace.Translator.Calls + trace.Guard.Calls,
            Tokens(trace.Classifier), Tokens(trace.Analyst), Tokens(trace.Generator), Tokens(trace.Reviewer), Tokens(trace.Translator),
            Tokens(trace.Guard));
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
        if (cached is { Source: TranslationCache.SourceNotTranslatable or TranslationCache.SourceRefused })
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

        // The content check: once per text, before any model or translator sees it.
        if (await Refused(key, trace, ct))
        {
            await cache.StoreVerdictAsync(key, direction, TranslationCache.SourceRefused, ct, replace: cached);
            return new TranslationResult.NotTranslatable();
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

        if (agentOn && !settled && !CanBeVerb(key))
        {
            // A sentence, or anything the agents do not read (Latin): the models have nothing to decide
            // here, so none is asked. The old translator answers, as it always did.
            settled = true;
        }
        else if (agentOn && !settled && !await budget.TrySpendAsync(ModelSpend.Request, ct))
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
        else if (agentOn && translation == null && CanBeVerb(key) && WordTranslatorOn)
        {
            // The models settled earlier that this is not a verb and the cache keeps only that verdict —
            // from before the word translator, or from a time it had no confirmed answer: it is asked now.
            if (await budget.TrySpendAsync(ModelSpend.Request, ct))
            {
                var answer = await TranslateWord(key, isRussian, direction, cached, trace, ct);
                if (answer != null)
                {
                    return answer;
                }
            }
            else
            {
                trace.Steps.Add("over-daily-budget");
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
        if (settled && CanBeVerb(key) && cached is not { Source: TranslationCache.SourceNoTranslation })
        {
            // The translator's answer is not kept: it has not been checked by anyone. The models' verdict
            // is — the next request for this text goes straight to the translator.
            await cache.StoreVerdictAsync(key, direction, TranslationCache.SourceNoTranslation, ct, replace: cached);
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

        // "Not something to translate" is taken from the classifier only for a single token (random
        // letters): a phrase of real words is always translated — a small model cannot tell «расскажи
        // анекдот» said to the bot from «где находится вокзал» said to be translated.
        if (classification.NotTranslatable && !key.Contains(' '))
        {
            return await ConfirmNotTranslatable(key, direction, cached, trace, ct);
        }

        if (!classification.IsVerb || !CanBeVerb(key))
        {
            // Not a verb: the word translator, and if it has no confirmed answer, the old translator.
            trace.Steps.Add("not-a-verb");
            return (WordTranslatorOn ? await TranslateWord(key, isRussian, direction, cached, trace, ct) : null, true);
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

        // From here on it is a verb the base does not have: the analyst, then possibly the generator.
        requester.VerbLookupStarted?.Invoke();
        string? lemmaHint = null;
        var canGenerate = true;
        IReadOnlyList<LexiconVerb> candidates;
        try
        {
            using var timeout = Timeout(options.Value.AnalystTimeoutSeconds, ct);
            var typos = isRussian ? [] : await verbBase.SearchAsync(key, timeout.Token);
            var asked = Ask(question, isRussian, typos);
            candidates = asked.Lexicon ?? [];
            if (question != key)
            {
                // The infinitive is new information: the lexicon may name its verb without the analyst.
                var bySource = await TryResolveBySource(asked, key, direction, cached, trace, ct);
                if (bySource != null)
                {
                    return (bySource, true);
                }
            }

            if (isRussian && candidates.Count > 0 && candidates.All(v => !v.HasTable))
            {
                // The lexicon names the verb(s) for this Russian word and says the source has no table
                // for any of them: there is nothing for the analyst to look up — straight to the generator.
                trace.Steps.Add("lexicon-no-table");
                lemmaHint = candidates.Count == 1 ? candidates[0].Lemma : null;
            }
            else
            {
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

                if (resolution.Verb != null)
                {
                    trace.Steps.Add($"verb-{resolution.Verb.Path}");
                    return (await AnswerAndRemember(resolution.Verb, key, question, direction, cached, ct), true);
                }

                trace.Steps.Add($"verb-rejected({resolution.Rejection})");
                lemmaHint = resolution.LemmaHint;
                canGenerate = resolution.CanGenerate;
            }
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Steps.Add("analyst-failed");
            logger.LogWarning("Verb analyst failed: {Error}", Describe(e));
            return (null, false);
        }

        // No table anywhere: the strong model writes the record, the second one approves it.
        if (!canGenerate || !options.Value.AllowGeneratedVerbs || !generationSwitch.IsOn)
        {
            return (null, true);
        }

        if (!await budget.TrySpendAsync(ModelSpend.Generation, ct))
        {
            // Not settled: tomorrow, or for another user, the verb may still be written.
            trace.Steps.Add("over-generation-budget");
            return (null, false);
        }

        try
        {
            var outcome = await generation.GenerateAsync(
                new VerbGenerationRequest(key, isRussian, isRussian ? question : null, lemmaHint, candidates), ct);
            trace.Generator += outcome.Generator;
            trace.Reviewer += outcome.Reviewer;
            trace.Steps.Add(
                $"generator>{outcome.Outcome}" + (outcome.Reason == null ? string.Empty : $"({outcome.Reason})")
                + (outcome.CompletionRounds > 0 ? "+completion" : string.Empty)
                + (outcome.DroppedRows > 0 ? "+rows-left-out" : string.Empty)
                + (outcome.RepairRounds > 0 ? "+repair" : string.Empty));
            if (outcome.Verb != null)
            {
                return (await AnswerAndRemember(outcome.Verb, key, question, direction, cached, ct), true);
            }

            if (outcome.SourceTable != null)
            {
                // The strong model named a verb the source has a table for: the table is what gets stored.
                using var timeout = Timeout(options.Value.AnalystTimeoutSeconds, ct);
                var fromSource = await resolver.ResolveAsync(
                    Ask(question, isRussian, []),
                    new VerbAnalystResult(outcome.SourceTable, new Dictionary<string, WiktionaryVerbPage?>()), timeout.Token, ct);
                trace.Steps.Add(fromSource.Verb == null ? $"table-rejected({fromSource.Rejection})" : $"verb-{fromSource.Verb.Path}");
                return fromSource.Verb == null
                    ? (null, true)
                    : (await AnswerAndRemember(fromSource.Verb, key, question, direction, cached, ct), true);
            }

            // Two models in a row — the classifier took it for a verb, the strong one says there is no
            // such word — and then the dictionary site: only all three make it "not a word".
            return outcome.NotAWord ? await ConfirmNotTranslatable(key, direction, cached, trace, ct) : (null, true);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Steps.Add("generator-failed");
            logger.LogWarning("Verb generation failed: {Error}", Describe(e));
            return (null, false);
        }
    }

    /// <summary>
    /// Whether the content check refuses the text. A check that is off, slow or broken refuses nothing:
    /// the text is translated as it was before the check existed.
    /// </summary>
    private async Task<bool> Refused(string key, Trace trace, CancellationToken ct)
    {
        if (!contentGuard.IsAvailable)
        {
            return false;
        }

        try
        {
            using var timeout = Timeout(options.Value.ContentGuardTimeoutSeconds, ct);
            var verdict = await contentGuard.CheckAsync(key, timeout.Token);
            trace.Guard += verdict.Usage ?? ModelUsage.None;
            if (verdict.Refusal == null)
            {
                return false;
            }

            trace.Steps.Add("refused");
            logger.LogWarning("Translation of {Word} refused by the content check: {Reason}", key, verdict.Refusal);
            return true;
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Steps.Add("guard-failed");
            logger.LogWarning("Content check failed: {Error}", Describe(e));
            return false;
        }
    }

    private bool WordTranslatorOn => options.Value.TranslateWordsWithModel && wordTranslator.IsAvailable;

    /// <summary>An answer of more words than this is not checked word by word: it is served unconfirmed.</summary>
    private const int MaxWordsToConfirm = 4;

    public const string UnconfirmedWordNote = "в словаре не нашлось — перевод нейросети, лучше перепроверить";

    /// <summary>
    /// A plain word or a short phrase: the model translates it the way people say it, the dictionary
    /// site is the second opinion. Null — no answer here, the old translator is next.
    /// </summary>
    private async Task<TranslationResult?> TranslateWord(
        string key, bool isRussian, TranslationDirection direction, TranslationCacheEntry? cached, Trace trace, CancellationToken ct)
    {
        try
        {
            using var timeout = Timeout(options.Value.WordTranslatorTimeoutSeconds, ct);
            var entry = await LookUp(key, timeout.Token);
            var question = new WordQuestion(key, isRussian, entry?.Translations ?? []);
            var answer = await wordTranslator.TranslateAsync(question, timeout.Token);
            trace.Translator += answer.Usage ?? ModelUsage.None;
            var check = await Check(answer, isRussian, entry, timeout.Token);
            if (check.Problem != null)
            {
                // One retry, told what the dictionary did not find. Never a second one.
                trace.Steps.Add("word-retry");
                answer = await wordTranslator.TranslateAsync(question with { Feedback = check.Problem }, timeout.Token);
                trace.Translator += answer.Usage ?? ModelUsage.None;
                check = await Check(answer, isRussian, entry, timeout.Token);
            }

            if (answer.Translation == null)
            {
                trace.Steps.Add("word-none");
                return null;
            }

            if (check.Confirmed)
            {
                trace.Steps.Add("word-agent");
                var result = await WordAnswer(key, isRussian, answer, entry, confirmed: true, ct);
                await cache.StoreAsync(key, direction, result, TranslationCache.SourceWordAgent, classified: true, ct, replace: cached);
                return result;
            }

            if (check.Problem != null)
            {
                // The dictionary knows the text but not the word the model gave, twice: its own entry wins.
                trace.Steps.Add("word-rejected");
                return null;
            }

            // Nothing to check against (a form or a slang word the dictionary does not have, or the site
            // is down): the model's answer is still better than machine translation, and it says so.
            trace.Steps.Add("word-unconfirmed");
            if (cached is not { Source: TranslationCache.SourceNoTranslation })
            {
                // Not the answer — it is asked for again next time; only that the text is not a verb.
                await cache.StoreVerdictAsync(key, direction, TranslationCache.SourceNoTranslation, ct, replace: cached);
            }

            return await WordAnswer(key, isRussian, answer, entry, confirmed: false, ct);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Steps.Add("word-failed");
            logger.LogWarning("Word translator failed: {Error}", Describe(e));
            return null;
        }
    }

    /// <summary>The dictionary's page for the text; null when the site could not be asked.</summary>
    private async Task<DictionaryEntry?> LookUp(string text, CancellationToken ct)
    {
        try
        {
            return await dictionary.LookupAsync(text, ct);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Dictionary site failed: {Error}", Describe(e));
            return null;
        }
    }

    /// <param name="Confirmed">The dictionary agrees: the answer is among its entries, or (Georgian answer) every word of it is in the dictionary.</param>
    /// <param name="Problem">The dictionary contradicts the answer — what to tell the model on the retry; null when it does not.</param>
    private sealed record WordCheck(bool Confirmed, string? Problem);

    private async Task<WordCheck> Check(WordTranslation answer, bool isRussian, DictionaryEntry? entry, CancellationToken ct)
    {
        if (answer.Translation == null)
        {
            return new WordCheck(false, null);
        }

        if (!isRussian)
        {
            // Russian is the model's own language; what needs to exist is the Georgian text, and the
            // dictionary having a page for it is that.
            return new WordCheck(entry is { Known: true }, null);
        }

        if (answer.Translation.DetectLanguage() != Language.Georgian)
        {
            return new WordCheck(false, "the translation must be Georgian, in Georgian script");
        }

        if (entry != null && entry.Translations.Any(t => SameText(t, answer.Translation)))
        {
            return new WordCheck(true, null);
        }

        var words = Words(answer.Translation);
        if (words.Count > MaxWordsToConfirm)
        {
            return new WordCheck(false, null);
        }

        var pages = new List<DictionaryEntry>();
        foreach (var word in words)
        {
            var page = await LookUp(word, ct);
            if (page == null)
            {
                return new WordCheck(false, null);
            }

            pages.Add(page);
        }

        var missing = words.Where((_, i) => !pages[i].Known).ToList();
        if (missing.Count == 0)
        {
            return new WordCheck(true, null);
        }

        // A one-word answer the dictionary has never heard of is a made-up or misspelled word. In a
        // phrase, an unknown word may be a form the dictionary lacks — that is only "unconfirmed",
        // unless the dictionary knows the asked text and so has something to compare with.
        return words.Count == 1 || entry is { Translations.Count: > 0 }
            ? new WordCheck(false, $"the dictionary has no Georgian word «{missing[0]}»; give a word that exists")
            : new WordCheck(false, null);
    }

    private async Task<TranslationResult.Success> WordAnswer(
        string key, bool isRussian, WordTranslation answer, DictionaryEntry? entry, bool confirmed, CancellationToken ct)
    {
        var translation = answer.Translation!;
        // A Georgian alternative is named only when the dictionary lists it for this text too.
        var alternatives = answer.Alternatives
            .Where(a => !SameText(a, translation))
            .Where(a => !isRussian || entry?.Translations.Any(t => SameText(t, a)) == true)
            .ToList();
        string?[] parts =
        [
            answer.Note,
            alternatives.Count == 0 ? null : $"ещё: {string.Join(", ", alternatives)}",
            confirmed ? null : UnconfirmedWordNote
        ];
        var info = string.Join("; ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        var example = confirmed ? await dictionary.ExampleAsync(key, translation, ct) : string.Empty;
        return new TranslationResult.Success(translation, info + Transcription(isRussian ? translation : key), example);
    }

    private static IReadOnlyList<string> Words(string text) =>
        text.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.Trim('?', '!', ',', '.', ';', ':', '«', '»', '"'))
            .Where(w => w.Length > 0)
            .ToList();

    private static bool SameText(string a, string b) =>
        string.Equals(a.Trim().TrimEnd('.', '!', '?'), b.Trim().TrimEnd('.', '!', '?'), StringComparison.OrdinalIgnoreCase);

    /// <summary>The agents know two languages, and a verb is a word or two; a phrase is for the plain translator.</summary>
    private static bool CanBeVerb(string key) =>
        !key.Any(char.IsAsciiLetter) && key.Split(' ').Length <= MaxWordsForVerbAnalysis;

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

        requester.VerbLookupStarted?.Invoke();
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
        // The verb is in the base now: when the text itself is found there (a form, a gloss, a Russian
        // form by its phrase), the first answer is the very one every later request will get.
        var fromBase = await AnswerFromVerbBase(key, direction == TranslationDirection.RussianToGeorgian, ct);
        if (fromBase != null)
        {
            return fromBase;
        }

        // The text is not something the base finds by itself (a Russian word the phrases do not cover,
        // a typo): then step 1 will not find it next time — the cache will.
        var match = new VerbBaseMatch(
            verb.Verb.Lemma, verb.Verb.Title, verb.Verb.Translation, verb.Verb.Status, "agent", verb.Form);
        var answer = await AnswerFromVerb(key, direction, match, question == key ? null : question, ct);
        await cache.StoreAsync(key, direction, answer, TranslationCache.SourceVerbAgent, classified: true, ct, replace: cached);
        return answer;
    }

    /// <summary>
    /// A model alone must not be able to refuse a real word. Its "not something to translate" is
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
        // «он сказал мне»: the table has the form for «он сказал»; whom it was said to is not in it.
        var setAside = VerbMeaningPhrases.Parse(key).SetAside;
        var notes = $"«{first.Meaning}»" + (first.MeaningNote == null ? string.Empty : $" ({first.MeaningNote})")
                    + (setAside == null ? string.Empty : $" — без «{setAside}»")
                    + (others.Count == 0 ? string.Empty : $"; ещё: {string.Join(", ", others)}");
        notes += await UnverifiedNote(first.Lemma, first.Form!, "; ", ct);
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
        if (direction == TranslationDirection.RussianToGeorgian && verb.Form == null)
        {
            // Asked by the Russian infinitive, the answer is the name of the action — what the dictionary
            // keeps and quizzes ask («делать» — the action, not «он делает»). The forms a learner needs
            // first go next to it; the reply itself is the verb card (VerbTranslationCardQuery). A verb
            // the base has no name of the action for is answered with its dictionary form, and says so.
            var card = await dbContext.Verbs.AsNoTracking().Where(v => v.Lemma == verb.Lemma).Select(v => v.CardJson).FirstOrDefaultAsync(ct);
            var lines = card == null ? [] : VerbTranslationCardQuery.KeyForms(card);
            var i = lines.FirstOrDefault(l => l is { Tense: "present", Person: 0, Meaning: not null });
            var he = lines.FirstOrDefault(l => l is { Tense: "present", Person: 2, Meaning: not null });
            var actionName = VerbTranslationCardQuery.ActionNameOf(verb.Lemma, verb.Title);
            string?[] parts =
            [
                infinitive == null ? null : $"это глагол «{infinitive}»",
                actionName != null ? VerbCardWording.ActionName : he == null ? null : $"это форма «{he.Meaning}»",
                i == null ? null : $"«{i.Meaning}» — {i.Georgian}",
                actionName == null || he == null ? null : $"«{he.Meaning}» — {he.Georgian}"
            ];
            var answer = actionName ?? verb.Lemma;
            return new TranslationResult.Success(
                answer, string.Join("; ", parts.Where(p => p != null)) + Transcription(answer), Example(card, verb.Lemma));
        }

        if (direction == TranslationDirection.RussianToGeorgian)
        {
            // An inflected Russian word the analyst tied to a form of the base: that form is the answer.
            var georgian = verb.Form;
            var info = infinitive == null ? string.Empty : $"это глагол «{infinitive}»";
            info += await UnverifiedNote(verb.Lemma, georgian, info.Length == 0 ? string.Empty : "; ", ct);
            return new TranslationResult.Success(georgian, info + Transcription(georgian), await ExampleFor(verb.Lemma, georgian, ct));
        }

        // The text is Georgian but not itself a form: the analyst read it as a misspelled one.
        var typo = verb.Form != null && !key.Split(' ').Contains(verb.Form) ? $"возможно, это форма {verb.Form}; " : string.Empty;
        if (verb.Meaning == null)
        {
            // გაღვიძება: the name of the action with a preverb — the card is under the plain one.
            var preverb = verb is { Match: "masdar", Form: null } && verb.Title != key ? $"с приставкой; без неё — {verb.Title}" : string.Empty;
            return new TranslationResult.Success(
                verb.Translation, (typo + preverb).TrimEnd(' ', ';') + Transcription(key), await ExampleFor(verb.Lemma, verb.Form, ct));
        }

        // A form of the base is translated as what it says — «мы писали», not the infinitive.
        var note = verb.MeaningNote == null ? string.Empty : $" ({verb.MeaningNote})";
        note += verb.Form == null ? string.Empty : await UnverifiedNote(verb.Lemma, verb.Form, "; ", ct);
        return new TranslationResult.Success(
            verb.Meaning,
            $"{typo}глагол «{verb.Translation}»{note}" + Transcription(key),
            await ExampleFor(verb.Lemma, verb.Form, ct));
    }

    public const string UnverifiedFormNote = "форма собрана автоматически и ещё не проверена";

    /// <summary>
    /// The answer is still given when the form sits only in unverified tenses of a model-made verb —
    /// it is the best the base has — but it says so, and such a form gets no parse line.
    /// </summary>
    private async Task<string> UnverifiedNote(string lemma, string form, string separator, CancellationToken ct)
    {
        var cells = await dbContext.VerbForms.AsNoTracking()
            .Where(f => f.Verb.Lemma == lemma && f.Form == form).Select(f => f.Unverified).ToListAsync(ct);
        return cells.Count > 0 && cells.All(unverified => unverified) ? separator + UnverifiedFormNote : string.Empty;
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
        return Example(card, form);
    }

    private static string Example(string? cardJson, string form)
    {
        var sentence = cardJson == null
            ? null
            : JsonNode.Parse(cardJson)?["sentences"]?.AsArray().FirstOrDefault(s => s?["form"]?.GetValue<string>() == form);
        return sentence == null ? string.Empty : $"{sentence["ka"]} — {sentence["ru"]}";
    }

    /// <summary>
    /// What goes to the log about a failed step: the kind of failure, and the message only when it is
    /// our own (<see cref="TranslationAgentException"/>). A provider's raw message can quote the
    /// request, credentials included, and does not belong in a log.
    /// </summary>
    public static string Describe(Exception e) => e switch
    {
        TranslationAgentException => e.Message,
        OperationCanceledException => "timeout",
        // The framework wraps what went wrong inside; the kinds are safe to name, the messages are not.
        AggregateException many => string.Join("+", many.Flatten().InnerExceptions.Select(Describe).Distinct()),
        _ when e.InnerException != null => $"{e.GetType().Name}({Describe(e.InnerException)})",
        _ => e.GetType().Name
    };

    private static CancellationTokenSource Timeout(int seconds, CancellationToken ct)
    {
        var source = CancellationTokenSource.CreateLinkedTokenSource(ct);
        source.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, seconds)));
        return source;
    }
}
