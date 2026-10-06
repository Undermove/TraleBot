using Application.Verbs;

namespace Application.Translation.Pipeline;

public enum GeneratedVerbVerdict
{
    /// <summary>The generator knows the verb and wrote its record.</summary>
    Verb,

    /// <summary>A real word or phrase, but not a verb the generator can write a record for — translate it the plain way.</summary>
    NotAVerb,

    /// <summary>Not a word of Russian or Georgian at all (a made-up verb, random letters).</summary>
    NotAWord
}

/// <summary>
/// The record of a verb as the strong model wrote it. Nothing in it is trusted until
/// <see cref="VerbGenerationService"/> has run its gates and the reviewer has approved it.
/// </summary>
/// <param name="Lemma">Dictionary form: 3rd person singular present.</param>
/// <param name="Masdar">The name of the action (verbal noun).</param>
/// <param name="Russian">Russian infinitive gloss, synonyms after commas.</param>
/// <param name="Tenses">tense → six cells in the order я, ты, он, мы, вы, они; a null cell = "not sure", left empty.</param>
/// <param name="RussianForms">Forms of the Russian verb the plain-Russian phrases are built from.</param>
/// <param name="MatchedTense">The cell the looked-up text is, as the model reads it; null when the text is the verb itself.</param>
public record GeneratedVerb(
    GeneratedVerbVerdict Verdict,
    string? Lemma = null,
    string? Masdar = null,
    string? Russian = null,
    IReadOnlyDictionary<string, string?[]>? Tenses = null,
    RussianVerbForms? RussianForms = null,
    string? MatchedTense = null,
    int? MatchedPerson = null,
    ModelUsage? Usage = null);

/// <param name="Text">The looked-up text as typed (normalised).</param>
/// <param name="Infinitive">For a Russian text — its dictionary infinitive, as the classifier named it.</param>
/// <param name="LemmaHint">The lemma the cheap agent proposed, if it proposed one. A hint, not a fact.</param>
/// <param name="Lexicon">What the open lexicon lists for the text or the hint. Checked facts.</param>
/// <param name="Previous">On the repair round: the record that was sent back.</param>
/// <param name="Problems">On the repair round: what the gates or the reviewer found in it.</param>
public record VerbGenerationRequest(
    string Text,
    bool IsRussian,
    string? Infinitive,
    string? LemmaHint,
    IReadOnlyList<LexiconVerb> Lexicon,
    GeneratedVerb? Previous = null,
    IReadOnlyList<string>? Problems = null);

/// <summary>The strong model: writes the full record of a verb the base and the source tables do not have.</summary>
public interface IVerbGenerator
{
    Task<GeneratedVerb> GenerateAsync(VerbGenerationRequest request, CancellationToken ct);
}

/// <summary>What our own data says about a record — handed to the reviewer next to it.</summary>
/// <param name="LexiconEntry">The open lexicon's entry for the lemma, if it has one.</param>
/// <param name="LexiconForAsked">Verbs the lexicon translates the asked Russian infinitive with.</param>
/// <param name="CorpusAvailable">False when the corpus data is not loaded: the attested counts then mean nothing.</param>
/// <param name="Unattested">Forms of the record that never occur in the corpora of real texts.</param>
public record VerbEvidence(
    LexiconVerb? LexiconEntry,
    IReadOnlyList<LexiconVerb> LexiconForAsked,
    bool CorpusAvailable,
    int FormsTotal,
    int FormsAttested,
    IReadOnlyList<string> Unattested);

/// <param name="Text">The looked-up text.</param>
/// <param name="Lemma">The record as it would be stored.</param>
/// <param name="Meanings">tense → six plain-Russian phrases built from the record's Russian forms.</param>
/// <param name="MatchedForm">The form the looked-up text was matched to, with its cell; null when the text is the verb itself.</param>
public record VerbReviewRequest(
    string Text,
    bool IsRussian,
    string? Infinitive,
    string Lemma,
    string? Masdar,
    string Russian,
    IReadOnlyDictionary<string, string[][]> Tenses,
    IReadOnlyDictionary<string, string[]> Meanings,
    string? MatchedForm,
    string? MatchedTense,
    int? MatchedPerson,
    VerbEvidence Evidence);

public record VerbReview(bool Approved, IReadOnlyList<string> Reasons, ModelUsage? Usage = null);

/// <summary>The second model: approves or rejects a generated record, with reasons.</summary>
public interface IVerbReviewer
{
    Task<VerbReview> ReviewAsync(VerbReviewRequest request, CancellationToken ct);
}

/// <summary>Whether the generation path can run: both roles configured, with different models.</summary>
public interface IVerbGenerationSwitch
{
    bool IsOn { get; }
}
