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
    /// Total XP spent on treats in the treat shop.
    /// Available XP = Xp - XpSpent.
    /// </summary>
    public int XpSpent { get; set; }

    /// <summary>
    /// Total number of treats given to Bombora across all time.
    /// </summary>
    public int TotalTreatsGiven { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
