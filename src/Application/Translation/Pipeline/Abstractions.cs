using Application.Verbs;

namespace Application.Translation.Pipeline;

/// <summary>Whether the agent path can run at all: switched on, with a key and model ids configured.</summary>
public interface ITranslationAgentSwitch
{
    bool IsOn { get; }
}

/// <param name="IsTranslationRequest">False for chat, questions, junk — anything that is not a word or phrase to translate.</param>
/// <param name="IsVerb">The text is one verb in any form (possibly with a pronoun or a particle).</param>
/// <param name="Language">"ru" | "ka" | "other" — as the model sees it; informational.</param>
public record TranslationClassification(bool IsTranslationRequest, bool IsVerb, string Language);

/// <summary>Step 1 of the agent path — the cheap model.</summary>
public interface ITranslationRequestClassifier
{
    Task<TranslationClassification> ClassifyAsync(string text, CancellationToken ct);
}

public enum VerbProposalOutcome
{
    /// <summary>The analyst could not tie the text to a verb.</summary>
    None,

    /// <summary>The verb is already in the base (found through the search tool).</summary>
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
/// <param name="Russian">Russian translation of the verb, an infinitive.</param>
/// <param name="Form">The Georgian form that answers the user's word, when the word was Russian or misspelled.</param>
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
public record VerbAnalystResult(VerbProposal Proposal, IReadOnlyDictionary<string, WiktionaryVerbPage?> FetchedPages);

/// <summary>Step 2 of the agent path — the stronger model with tools over the verb base and Wiktionary.</summary>
public interface IVerbAnalyst
{
    Task<VerbAnalystResult> AnalyzeAsync(string text, CancellationToken ct);
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
