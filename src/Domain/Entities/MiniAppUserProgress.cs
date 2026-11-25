// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// Persistent progress state for the Kutya mini-app: XP, streak, hearts and completed lessons.
/// One row per user.
/// </summary>
public class MiniAppUserProgress
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public virtual User? User { get; set; }

    public int Xp { get; set; }

    public int Streak { get; set; }
    public DateTime? LastPlayedAtUtc { get; set; }

    public int Hearts { get; set; }
    public int MaxHearts { get; set; }
    public DateTime? HeartsUpdatedAtUtc { get; set; }

    /// <summary>
    /// User's self-reported level: "beginner" or "intermediate".
    /// Null means onboarding not completed yet.
    /// </summary>
    public string? Level { get; set; }

    /// <summary>
    /// JSON map of moduleId -> int[] of completed lesson ids.
    /// </summary>
    public string CompletedLessonsJson { get; set; } = "{}";

    /// <summary>
    /// JSON map of sentenceBuilder questionId -> number of times answered correctly.
    /// Used by the progression gate to unlock L4/L5 questions once L3/L4 mastery threshold is met.
    /// </summary>
    public string SentenceBuilderProgressJson { get; set; } = "{}";

    /// <summary>
    /// JSON state for the contextual onboarding engine: which hint keys were already
    /// surfaced and when the last one was shown (for the time-spread gating).
    /// Null until the first hint is shown. See <c>Application.Onboarding</c>.
    /// </summary>
    public string? OnboardingHintsJson { get; set; }

    /// <summary>
    /// JSON array of ISO-8601 UTC timestamps, one per distinct UTC day the user
    /// played the mini-app. Backs the profile activity heatmap: mini-app plays
    /// otherwise leave only the single <see cref="LastPlayedAtUtc"/> point, so
    /// without this log a daily learner would light up just one cell.
    /// Null until the first play after this column shipped.
    /// </summary>
    public string? ActivityDaysJson { get; set; }

    /// <summary>
    /// Total XP spent on treats in the treat shop.
    /// Available XP = Xp - XpSpent.
    /// </summary>
    public int XpSpent { get; set; }

    /// <summary>
    /// Total number of treats given to Bombora across all time.
    /// </summary>
    public int TotalTreatsGiven { get; set; }

    /// <summary>
    /// When Bombora was last fed a treat. Used to derive mascot hunger state.
    /// </summary>
    public DateTime? LastFedAtUtc { get; set; }

    /// <summary>
    /// Index (0..4) of the last treat given — picks the satiety tier shown on the mascot.
    /// Null when never fed.
    /// </summary>
    public int? LastTreatIndex { get; set; }

    /// <summary>Streak freezes from the gift of the day: each one covers a missed day so the streak goes on.</summary>
    public int StreakFreezes { get; set; }

    /// <summary>The day (UTC) the task of the day and its extra rounds give double XP — a prize of the gift of the day.</summary>
    public DateOnly? XpBoostDay { get; set; }

    /// <summary>
    /// When the gift of the day last gave free days. Null — never: the very first box gives them for sure
    /// (+3, the "wow"); after that +1 day drops at most once in <c>DailyGiftService.DaysCooldown</c>.
    /// </summary>
    public DateTime? GiftDaysAtUtc { get; set; }

    /// <summary>The last day (UTC) a new module lesson was passed — that opens the second gift of the day.</summary>
    public DateOnly? GiftLessonDay { get; set; }

    /// <summary>What the gift of the day gave to keep (hints, words, postcards, things, furniture) — JSON, see <c>GiftStash</c>.</summary>
    public string? GiftStashJson { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
