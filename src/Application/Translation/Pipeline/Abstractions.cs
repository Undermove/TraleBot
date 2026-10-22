using Application.Verbs;

namespace Application.Translation.Pipeline;

/// <summary>Whether the agent path can run at all: switched on, with a key and model ids configured.</summary>
public interface ITranslationAgentSwitch
{
    bool IsOn { get; }
}

/// <summary>What one step spent on models — goes into the request log line.</summary>
public record ModelUsage(int Calls, long InputTokens, long OutputTokens)
{
    public static readonly ModelUsage None = new(0, 0, 0);

    public static ModelUsage operator +(ModelUsage a, ModelUsage b) =>
        new(a.Calls + b.Calls, a.InputTokens + b.InputTokens, a.OutputTokens + b.OutputTokens);
}

/// <param name="NotTranslatable">
/// The classifier is confident the text is not something to look up in a dictionary: gibberish,
/// chat, a command. False for anything it is not sure about — a real word is the default.
/// </param>
/// <param name="IsVerb">The text is one verb in any form (possibly with a pronoun or a particle).</param>
/// <param name="RussianInfinitive">For a Russian verb — its dictionary form («ходил» → «ходить»); else null.</param>
public record TranslationClassification(
    bool NotTranslatable, bool IsVerb, string? RussianInfinitive = null, ModelUsage? Usage = null);

/// <summary>Step 1 of the agent path — the cheap model, one call.</summary>
public interface ITranslationRequestClassifier
{
    Task<TranslationClassification> ClassifyAsync(string text, CancellationToken ct);
}

public enum VerbProposalOutcome
{
    /// <summary>The analyst could not tie the text to a verb.</summary>
    None,

    /// <summary>A misspelled Georgian form of a verb that is already in the base.</summary>
    Existing,

    /// <summary>The source has a conjugation table for <see cref="VerbProposal.Lemma"/>.</summary>
    Wiktionary,

    /// <summary>
    /// The analyst names the verb but the source has no conjugation table for it: the record is for the
    /// generator to write (<see cref="VerbGenerationService"/>). The analyst's own forms are never stored.
    /// </summary>
    NoTable
}

/// <summary>
/// What the analyst proposes. Nothing here is trusted: <see cref="VerbProposalResolver"/> checks every
/// field against the base and the source before anything is stored or shown.
/// </summary>
/// <param name="Lemma">Dictionary form of the verb (3rd person singular present).</param>
/// <param name="Russian">Russian translation of the verb, dictionary infinitive(s).</param>
/// <param name="Form">For a misspelled Georgian word — the form it was taken for.</param>
public record VerbProposal(
    VerbProposalOutcome Outcome,
    string? Lemma = null,
    string? Russian = null,
    string? Form = null);

/// <param name="FetchedPages">
/// Every page the analyst asked the source for during the run, by page title; null value = no page or
/// no conjugation table. The stored paradigm is taken from here, never from the model's text.
/// </param>
/// <param name="ToolCalls">Names of the tools the model called, in order — for the request log.</param>
public record VerbAnalystResult(
    VerbProposal Proposal,
    IReadOnlyDictionary<string, WiktionaryVerbPage?> FetchedPages,
    ModelUsage? Usage = null,
    IReadOnlyList<string>? ToolCalls = null);

/// <summary>What the analyst is asked about, with what our own data already says — so that no model call is spent on finding it.</summary>
/// <param name="Text">A Russian infinitive, or a Georgian word as typed.</param>
/// <param name="Candidates">Verbs of the base one letter away from a Georgian word — a possible typo.</param>
/// <param name="Lexicon">What the Wiktionary lexicon has for the text: verbs translated with this Russian word, or the verb with this lemma / verbal noun.</param>
/// <param name="Feedback">On the one retry: the concrete discrepancy the checks found in the first proposal.</param>
public record VerbQuestion(
    string Text,
    bool IsRussian,
    IReadOnlyList<VerbBaseMatch> Candidates,
    IReadOnlyList<LexiconVerb>? Lexicon = null,
    string? Feedback = null);

/// <summary>Step 2 of the agent path — the stronger model with a tool over Wiktionary.</summary>
public interface IVerbAnalyst
{
    Task<VerbAnalystResult> AnalyzeAsync(VerbQuestion question, CancellationToken ct);
}

public record WiktionaryVerbPage(VerbParadigm Paradigm, IReadOnlyList<string> EnglishGlosses);

/// <summary>Conjugation tables of Georgian verbs from the English Wiktionary (CC BY-SA 4.0).</summary>
public interface IWiktionaryVerbSource
{
    /// <summary>
    /// The verb on the page, or null when there is no such page or it has no conjugation table.
    /// Throws when the source could not be reached — "unknown" must not be mistaken for "no table".
    /// </summary>
    Task<WiktionaryVerbPage?> FetchAsync(string page, CancellationToken ct);
}

/// <summary>A model step failed in a way worth naming in the log: "the provider answered 429", "no result".</summary>
/// <summary>A word or a short phrase that is not a verb, for <see cref="IWordTranslator"/>.</summary>
/// <param name="Text">The text as asked, normalised.</param>
/// <param name="DictionaryTranslations">What the dictionary site lists for the text — a hint, often with rare or scientific entries first.</param>
/// <param name="Feedback">Why the previous answer was not accepted — for the one retry.</param>
public record WordQuestion(string Text, bool IsRussian, IReadOnlyList<string> DictionaryTranslations, string? Feedback = null);

/// <param name="Translation">The everyday translation; null when the model has none.</param>
/// <param name="Alternatives">Other common translations, at most a few.</param>
/// <param name="Note">A short Russian remark for the learner (register, «разговорное»), or null.</param>
public record WordTranslation(string? Translation, IReadOnlyList<string> Alternatives, string? Note, ModelUsage? Usage = null);

/// <summary>A model translates a plain word the way people say it; the pipeline checks the answer against the dictionary.</summary>
public interface IWordTranslator
{
    /// <summary>False when no model is configured for it: plain words then go to the old translator.</summary>
    bool IsAvailable { get; }

    Task<WordTranslation> TranslateAsync(WordQuestion question, CancellationToken ct);
}

public class TranslationAgentException(string message) : Exception(message);

/// <param name="Refusal">Why the text is not translated (the names of the checks it failed), or null when it may be.</param>
public record ContentVerdict(string? Refusal, ModelUsage? Usage = null);

/// <summary>
/// The check before any translation: is the text something the app translates at all. Ordinary rude
/// words and swearing pass — they belong in a dictionary; what is refused is content about children
/// and sex, threats, hate against a group and requests to write something instead of translating.
/// </summary>
public interface IContentGuard
{
    bool IsAvailable { get; }

    /// <summary>Throws when the check could not be made; the caller then lets the text through.</summary>
    Task<ContentVerdict> CheckAsync(string text, CancellationToken ct);
}

/// <param name="Georgian">The message in Georgian script: the translation of a Russian text, the text itself
/// written in Georgian letters when it came in Latin ones; null when the text is not Russian or Georgian.</param>
/// <param name="Russian">The message in Russian.</param>
public record PhraseTranslation(string? Georgian, string? Russian, ModelUsage? Usage = null);

/// <summary>
/// One fast model call that translates a whole message between Russian and Georgian — for inline mode,
/// where Telegram waits a few seconds only. Georgian may come in Latin letters, the way Georgians often
/// type («gamarjoba, rogor xar?»). Not a dictionary: nothing is checked against a source and nothing is stored.
/// </summary>
public interface IPhraseTranslator
{
    bool IsAvailable { get; }

    Task<PhraseTranslation> TranslateAsync(string text, CancellationToken ct);
}
