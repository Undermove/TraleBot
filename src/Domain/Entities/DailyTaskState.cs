// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
namespace Domain.Entities;

/// <summary>
/// What the "task of the day" remembers about one learner between days: how the last games went
/// (that is what picks today's mode and level), what was offered as "new" last time, and the task
/// composed for the current day together with its result.
/// One row per learner; appears with the first task.
/// </summary>
public class DailyTaskState
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;

    /// <summary>Smoothed accuracy of the pairs game, 40..100; null until the first game.</summary>
    public int? Accuracy { get; set; }

    /// <summary>Mistakes in the last finished game.</summary>
    public int LastErrors { get; set; }

    /// <summary>What "new" was opened last: "forms" or "lesson" — the next offer alternates.</summary>
    public string? LastNew { get; set; }

    /// <summary>JSON array of form keys ("v:lemma:tense:person") missed in the last game.</summary>
    public string MissedJson { get; set; } = "[]";

    /// <summary>JSON object moduleId → "known" | "lessons": how the one-minute module checks ended.</summary>
    public string CourseJson { get; set; } = "{}";

    /// <summary>The day (UTC, same as the streak) the task in <see cref="TaskJson"/> was composed for.</summary>
    public DateOnly? Day { get; set; }

    /// <summary>The task of <see cref="Day"/> as the mini-app got it, with the result once it is played.</summary>
    public string? TaskJson { get; set; }

    /// <summary>The last day a task was finished.</summary>
    public DateOnly? DoneDay { get; set; }

    /// <summary>
    /// The gifts of the day opened on <see cref="Day"/>: JSON <c>{"day":"…","boxes":[{"box":0,"rarity":1,"prize":"freeze","code":null}]}</c>.
    /// Box 0 is for the task, box 1 for one more round after it. See <c>DailyGiftService</c>.
    /// </summary>
    public string? GiftJson { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
