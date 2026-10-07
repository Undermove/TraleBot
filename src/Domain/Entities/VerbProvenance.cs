// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// Where a model-made <see cref="Verb"/> came from: which model wrote the record, which model approved
/// it, and the evidence the approval was given with. One row per such verb; catalog verbs and verbs
/// taken from a Wiktionary table have none. This is what a later human revision lists and works from.
/// </summary>
public class VerbProvenance
{
    public Guid Id { get; set; }

    public Guid VerbId { get; set; }
    public virtual Verb Verb { get; set; } = null!;

    /// <summary>The text of the request that led to the verb (a word or a short verb phrase).</summary>
    public required string AskedText { get; set; }

    /// <summary>Id of the model that wrote the record.</summary>
    public required string GeneratorModel { get; set; }

    /// <summary>Id of the model that approved it.</summary>
    public required string ReviewerModel { get; set; }

    public DateTime ApprovedAtUtc { get; set; }

    /// <summary>0 — approved as written; 1 — approved after the one repair round.</summary>
    public int RepairRounds { get; set; }

    /// <summary>Distinct forms of the record, and how many of them occur in the corpora of real texts.</summary>
    public int FormsTotal { get; set; }

    public int FormsAttested { get; set; }

    /// <summary>JSON array of the forms that were not found in the corpora.</summary>
    public required string UnattestedFormsJson { get; set; }

    /// <summary>
    /// JSON array: the main tenses the record does not have and why — <c>{"tense","why","note","reviewerDisagrees"}</c>,
    /// where <c>why</c> is "verb-lacks-it" (the generator, asked for the tense specifically, said the verb
    /// has none; <c>note</c> is its reason) or "not-sure" (it did not give the forms). Empty when all six are there.
    /// </summary>
    public string MissingTensesJson { get; set; } = "[]";

    /// <summary>JSON array of the main tenses that were added on the completion round (the second ask).</summary>
    public string CompletedTensesJson { get; set; } = "[]";

    /// <summary>Whether the open lexicon (Wiktionary) has a verb with this lemma.</summary>
    public bool LemmaInLexicon { get; set; }

    /// <summary>What the reviewer said when approving, one reason per line.</summary>
    public required string ReviewerReasons { get; set; }

    /// <summary>Set when a human has looked the verb over; null — not revised yet.</summary>
    public DateTime? RevisedAtUtc { get; set; }
}
