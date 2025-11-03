using Domain.Entities;

namespace Application.GeorgianVerbs;

public interface IVerbSrsService
{
    /// <summary>
    /// Получить следующую карточку для студента на основе SRS
    /// </summary>
    Task<VerbCard?> GetNextCardForUserAsync(Guid userId, CancellationToken ct);
    
    /// <summary>
    /// Получить трудные карточки для повторения
    /// </summary>
    Task<List<VerbCard>> GetHardCardsForUserAsync(Guid userId, int limit = 5, CancellationToken ct = default);
    
    /// <summary>
    /// Получить статистику прогресса за день
    /// </summary>
    Task<DailyVerbProgressDto> GetDailyProgressAsync(Guid userId, CancellationToken ct);
    
    /// <summary>
    /// Получить статистику за неделю
    /// </summary>
    Task<WeeklyVerbProgressDto> GetWeeklyProgressAsync(Guid userId, CancellationToken ct);
}

public record DailyVerbProgressDto(
    int CardsStudiedToday,
    int CorrectAnswers,
    double AccuracyPercentage,
    int CurrentStreak,
    int NewCardsAdded);

public record WeeklyVerbProgressDto(
    Dictionary<DayOfWeek, int> DailyStudyDays,
    int TotalCardsStudied,
    int TotalCorrectAnswers,
    double OverallAccuracy);