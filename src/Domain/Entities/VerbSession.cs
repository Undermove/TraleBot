// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// One 2–3 minute play session on a verb. The mini-app composes it (a few short scenes) and reports
/// where the learner is after every answer, so a reload or another device continues from the same
/// place. <see cref="Id"/> comes from the mini-app, which is what makes "finished" — and its XP —
/// count once however many times the report is replayed.
/// </summary>
public class VerbSession
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;

    public Guid VerbId { get; set; }
    public virtual Verb Verb { get; set; } = null!;

    /// <summary>The composed session as the mini-app planned it (scenes, their targets and sizes).</summary>
    public required string PlanJson { get; set; }

    /// <summary>Index of the scene being played.</summary>
    public int Scene { get; set; }

    /// <summary>Tasks answered inside that scene.</summary>
    public int Done { get; set; }

    public DateTime StartedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    /// <summary>Null while the session is still being played.</summary>
    public DateTime? FinishedAtUtc { get; set; }

    /// <summary>XP credited for finishing; 0 when the daily cap was already reached.</summary>
    public int XpEarned { get; set; }
}
