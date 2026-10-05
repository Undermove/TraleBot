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
/// Translation of a Georgian / Russian word or phrase. Each request goes down this ladder and stops
/// at the first step that answers:
/// <list type="number">
/// <item>the verb base — an exact form, masdar or translation hit is answered from the database;</item>
/// <item>the translation cache — a text that was looked up before;</item>
/// <item>the classifier (cheap model): is it a translation request at all, and is it a verb;</item>
/// <item>for a verb — the analyst (stronger model with tools over the base and Wiktionary), then
///   <see cref="VerbProposalResolver"/> validates and stores the verb, so the next request stops at step 1 or 2;</item>
/// <item>everything else — the translator that was here before (<see cref="GeorgianTranslationModule"/>:
///   dictionary site, then Google), and its answer goes to the cache.</item>
/// </list>
/// Steps 1, 3 and 4 run only when the agent path is on (<see cref="ITranslationAgentSwitch"/>); off, this
/// is the old translator behind a cache. Any failure of a model or tool step — no key, quota, timeout,
/// malformed output — falls through to step 5, so the user gets what they would have got before.
/// </summary>
public class GeorgianTranslationPipeline(
    GeorgianTranslationModule legacy,
    TranslationCache cache,
    VerbBaseSearch verbBase,
    ITranslationAgentSwitch agentSwitch,
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

    public async Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct)
    {
        var stopwatch = Stopwatch.StartNew();
        var trace = new List<string>();
        var result = await Run(wordToTranslate, trace, ct);

        // One line per request: which steps ran and how long it all took. The looked-up text is the
        // only user input in it.
        logger.LogInformation(
            "Translation of {Word}: path {Path}, {Outcome}, {ElapsedMs} ms",
            wordToTranslate, string.Join(">", trace), result.GetType().Name, stopwatch.ElapsedMilliseconds);
        return result;
    }

    private async Task<TranslationResult> Run(string word, List<string> trace, CancellationToken ct)
    {
        var key = TranslationCacheKey.Normalize(word);
        if (key == null)
        {
            trace.Add("legacy");
            return await legacy.Translate(word, ct);
        }

        var direction = key.DetectLanguage() == Language.Russian
            ? TranslationDirection.RussianToGeorgian
            : TranslationDirection.GeorgianToRussian;
        // The agents know two languages. Latin text reaches this module too (an English dictionary word
        // being re-translated into Georgian) and goes the old way.
        var agentOn = agentSwitch.IsOn && !key.Any(char.IsAsciiLetter);

        if (agentOn)
        {
            var known = await verbBase.FindExactAsync(key, ct);
            if (known != null)
            {
                trace.Add("verb-base");
                return await AnswerFromVerb(key, direction, known.Lemma, known.Title, known.Translation, known.Form, ct);
            }
        }

        var cached = await cache.FindAsync(key, direction, ct);
        // An entry cached while the agent was off has never been looked at by the classifier: it may
        // be a verb. It takes the agent path once; after that the flag (or the stored verb) answers.
        var classified = cached?.Classified ?? false;
        if (cached != null && (!agentOn || classified))
        {
            trace.Add("cache");
            return await ServeCached(cached, classified, ct);
        }

        if (agentOn && key.Split(' ').Length <= MaxWordsForVerbAnalysis)
        {
            var (verb, settled) = await TryResolveVerb(key, trace, ct);
            classified = settled;
            if (verb != null)
            {
                var answer = await AnswerFromVerb(
                    key, direction, verb.Verb.Lemma, verb.Verb.Title, verb.Verb.Translation, verb.Form, ct);
                // The text itself is not a form of the verb (a Russian word, a typo), so the exact
                // lookup of step 1 will not find it next time — the cache will.
                if (await verbBase.FindExactAsync(key, ct) == null)
                {
                    await cache.StoreAsync(
                        key, direction, answer, TranslationCache.SourceVerbAgent, classified: true, ct, replace: cached);
                }

                return answer;
            }
        }

        if (cached != null)
        {
            trace.Add("cache");
            return await ServeCached(cached, classified, ct);
        }

        trace.Add("legacy");
        var translated = await legacy.Translate(word, ct);
        if (translated is TranslationResult.Success success)
        {
            await cache.StoreAsync(key, direction, success, TranslationCache.SourceExternal, classified, ct);
        }

        return translated;
    }

    /// <summary>
    /// Steps 3 and 4. <c>Settled</c> tells whether the question "does this text need the verb
    /// analysis" got a final answer: yes after a clean "not a verb" or a rejected proposal, no after a
    /// timeout or an error — then the text is asked about again next time instead of being written off.
    /// </summary>
    private async Task<(ResolvedVerb? Verb, bool Settled)> TryResolveVerb(string key, List<string> trace, CancellationToken ct)
    {
        TranslationClassification classification;
        try
        {
            using var timeout = Timeout(options.Value.ClassifierTimeoutSeconds, ct);
            classification = await classifier.ClassifyAsync(key, timeout.Token);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Add("classifier-failed");
            logger.LogWarning(e, "Translation classifier failed");
            return (null, false);
        }

        if (!classification.IsTranslationRequest)
        {
            trace.Add("not-a-translation");
            return (null, true);
        }

        if (!classification.IsVerb)
        {
            trace.Add("not-a-verb");
            return (null, true);
        }

        try
        {
            using var timeout = Timeout(options.Value.AnalystTimeoutSeconds, ct);
            var analysis = await analyst.AnalyzeAsync(key, timeout.Token);
            var verb = await resolver.ResolveAsync(key, analysis, timeout.Token, ct);
            trace.Add(verb == null ? "verb-rejected" : $"verb-{verb.Path}");
            return (verb, true);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            trace.Add("analyst-failed");
            logger.LogWarning(e, "Verb analyst failed");
            return (null, false);
        }
    }

    private async Task<TranslationResult> ServeCached(TranslationCacheEntry entry, bool classified, CancellationToken ct)
    {
        await cache.RecordHitAsync(entry, classified, ct);
        return new TranslationResult.Success(entry.Definition, entry.AdditionalInfo, entry.Example);
    }

    /// <summary>
    /// The answer for a text that is a verb of the base. Every Georgian word in it comes from the
    /// stored verb. The parse line (tense, person) is not part of the translation — the bot and the
    /// mini-app add it from the form index.
    /// </summary>
    private async Task<TranslationResult.Success> AnswerFromVerb(
        string key,
        TranslationDirection direction,
        string lemma,
        string title,
        string translation,
        string? form,
        CancellationToken ct)
    {
        if (direction == TranslationDirection.RussianToGeorgian)
        {
            var georgian = form ?? title;
            return new TranslationResult.Success(georgian, Transcription(georgian), await ExampleFor(lemma, georgian, ct));
        }

        // The text is Georgian but not itself a form: the analyst read it as a misspelled one.
        var hint = form != null && !key.Split(' ').Contains(form) ? $"возможно, это форма {form}" : string.Empty;
        return new TranslationResult.Success(translation, hint + Transcription(key), await ExampleFor(lemma, form, ct));
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

    private static CancellationTokenSource Timeout(int seconds, CancellationToken ct)
    {
        var source = CancellationTokenSource.CreateLinkedTokenSource(ct);
        source.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, seconds)));
        return source;
    }
}
