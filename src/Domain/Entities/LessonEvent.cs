// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// One step of a learner through a mini-app lesson: the lesson opened, a step (game, letter intro, new word…)
/// started / finished / skipped, the lesson counted, failed or left halfway. Written by the mini-app in small
/// batches (<c>POST /api/miniapp/events</c>) so the place where people drop off inside a lesson can be found
/// (<c>docs/analytics/lesson-funnel.sql</c>). Nothing about the person beyond <see cref="UserId"/>.
/// </summary>
public class LessonEvent
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;

    /// <summary>Module id, e.g. <c>alphabet-progressive</c>.</summary>
    public required string ModuleId { get; set; }

    public int LessonId { get; set; }

    /// <summary>Position of the step in the lesson flow (0 = the opener).</summary>
    public int Step { get; set; }

    /// <summary>What the step is (server whitelist): <c>catch</c>, <c>new-word</c>, <c>check</c>…</summary>
    public required string StepKind { get; set; }

    /// <summary>What happened (server whitelist): <c>step_start</c>, <c>lesson_exit</c>…</summary>
    public required string Event { get; set; }

    /// <summary>Optional small number: score, guests served, attempts.</summary>
    public int? Value { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}
