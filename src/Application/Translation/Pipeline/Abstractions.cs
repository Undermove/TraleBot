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

    /// <summary>No table anywhere; the forms in <see cref="VerbProposal.GeneratedTenses"/> are the model's own.</summary>
    Generated
}

/// <summary>
/// What the analyst proposes. Nothing here is trusted: <see cref="VerbProposalResolver"/> checks every
/// field against the base and the source before anything is stored or shown.
/// </summary>
/// <param name="Lemma">Dictionary form of the verb (3rd person singular present).</param>
/// <param name="Russian">Russian translation of the verb, dictionary infinitive(s).</param>
/// <param name="Form">For a misspelled Georgian word — the form it was taken for.</param>
/// <param name="GeneratedTenses">tense → six persons, one form each. Only for <see cref="VerbProposalOutcome.Generated"/>.</param>
public record VerbProposal(
    VerbProposalOutcome Outcome,
    string? Lemma = null,
    string? Russian = null,
    string? Form = null,
    string? GeneratedMasdar = null,
    IReadOnlyDictionary<string, string[]>? GeneratedTenses = null);

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
public class TranslationAgentException(string message) : Exception(message);
