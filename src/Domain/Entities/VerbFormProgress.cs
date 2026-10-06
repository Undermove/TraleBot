// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// How far one user has climbed the "ladder" for one cell of a verb's paradigm (verb, tense, person).
/// A row appears when the form is first introduced; <see cref="Step"/> rises with every correct task
/// and drops by one on a mistake. A mastered form gets <see cref="NextDueAtUtc"/> and comes back for
/// repetition.
/// </summary>
public class VerbFormProgress
{
    /// <summary>The step at which a form counts as learned and leaves active play.</summary>
    public const int MasteredStep = 6;

    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;

    public Guid VerbId { get; set; }
    public virtual Verb Verb { get; set; } = null!;

    /// <summary>Tense key as used by the mini-app: present, aorist, optative, …</summary>
    public required string Tense { get; set; }

    /// <summary>0..5 — я, ты, он, мы, вы, они.</summary>
    public int Person { get; set; }

    /// <summary>1..<see cref="MasteredStep"/>: which task the form is asked with next.</summary>
    public int Step { get; set; }

    /// <summary>Highest step ever reached — progress shown to the learner never goes backwards.</summary>
    public int BestStep { get; set; }

    /// <summary>How many repetitions of the mastered form were answered correctly.</summary>
    public int Reviews { get; set; }

    /// <summary>When the mastered form should be asked again; null while it is still being learned.</summary>
    public DateTime? NextDueAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    /// <summary>
    /// Time of the answer this row reflects (client clock, capped by server time). Saves are
    /// last-write-wins by this value, which is what makes replayed batches harmless.
    /// </summary>
    public DateTime UpdatedAtUtc { get; set; }
}
