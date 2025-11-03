using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.GeorgianVerbs.Services;

public class VerbSrsService : IVerbSrsService
{
    private readonly ITraleDbContext _context;

    public VerbSrsService(ITraleDbContext context)
    {
        _context = context;
    }

    public async Task<VerbCard?> GetNextCardForUserAsync(Guid userId, CancellationToken ct)
    {
        // 1. Получаем карточки, которые готовы к повторению (NextReviewDate <= now)
        var now = DateTime.UtcNow;
        var existingProgress = await _context.StudentVerbProgress
            .Where(sp => sp.UserId == userId && sp.NextReviewDateUtc <= now)
            .OrderBy(sp => sp.NextReviewDateUtc)
            .ThenBy(sp => sp.IsMarkedAsHard ? 0 : 1) // приоритет трудным
            .FirstOrDefaultAsync(ct);

        if (existingProgress != null)
        {
            return await _context.VerbCards
                .Include(vc => vc.Verb)
                .FirstOrDefaultAsync(vc => vc.Id == existingProgress.VerbCardId, ct);
        }

        // 2. Если нет готовых к повторению, ищем новые карточки
        // Получаем максимальный wave, который уже учит студент
        var maxWave = await _context.StudentVerbProgress
            .Where(sp => sp.UserId == userId)
            .Include(sp => sp.VerbCard)
            .ThenInclude(vc => vc.Verb)
            .MaxAsync(sp => (int?)sp.VerbCard.Verb.Wave, ct) ?? 0;

        var nextWave = maxWave + 1;

        // Ищем первую карточку из следующей волны
        var newCard = await _context.VerbCards
            .Include(vc => vc.Verb)
            .Where(vc => vc.Verb.Wave == nextWave)
            .Where(vc => !_context.StudentVerbProgress.Any(sp => sp.UserId == userId && sp.VerbCardId == vc.Id))
            .OrderBy(vc => vc.ExerciseType) // Form -> Cloze -> Sentence
            .FirstOrDefaultAsync(ct);

        return newCard;
    }

    public async Task<List<VerbCard>> GetHardCardsForUserAsync(Guid userId, int limit = 5, CancellationToken ct = default)
    {
        return await _context.StudentVerbProgress
            .Where(sp => sp.UserId == userId && sp.IsMarkedAsHard)
            .OrderByDescending(sp => sp.IncorrectAnswersCount)
            .ThenBy(sp => sp.LastReviewDateUtc)
            .Take(limit)
            .Include(sp => sp.VerbCard)
            .ThenInclude(vc => vc.Verb)
            .Select(sp => sp.VerbCard)
            .ToListAsync(ct);
    }

    public async Task<DailyVerbProgressDto> GetDailyProgressAsync(Guid userId, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var todayProgress = await _context.StudentVerbProgress
            .Where(sp => sp.UserId == userId && sp.LastReviewDateUtc.Date == today)
            .ToListAsync(ct);

        var studied = todayProgress.Count;
        var correct = todayProgress.Count(sp => sp.CorrectAnswersCount > 0);
        var accuracy = studied > 0 ? (correct * 100.0 / studied) : 0;
        var currentStreak = todayProgress.Any() ? todayProgress.Max(sp => sp.CurrentStreak) : 0;
        var newCards = todayProgress.Count(sp => sp.SessionCount == 1);

        return new DailyVerbProgressDto(studied, correct, accuracy, currentStreak, newCards);
    }

    public async Task<WeeklyVerbProgressDto> GetWeeklyProgressAsync(Guid userId, CancellationToken ct)
    {
        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7).Date;
        var allProgress = await _context.StudentVerbProgress
            .Where(sp => sp.UserId == userId && sp.LastReviewDateUtc.Date >= sevenDaysAgo)
            .GroupBy(sp => sp.LastReviewDateUtc.Date)
            .Select(g => new { Date = g.Key, Count = g.Count(), Correct = g.Count(sp => sp.CorrectAnswersCount > 0) })
            .ToListAsync(ct);

        var dailyStudyDays = Enumerable.Range(0, 7)
            .ToDictionary(
                i => DateTime.UtcNow.AddDays(-i).DayOfWeek,
                i => allProgress.FirstOrDefault(p => p.Date == DateTime.UtcNow.AddDays(-i).Date)?.Count ?? 0);

        var totalStudied = allProgress.Sum(p => p.Count);
        var totalCorrect = allProgress.Sum(p => p.Correct);
        var accuracy = totalStudied > 0 ? (totalCorrect * 100.0 / totalStudied) : 0;

        return new WeeklyVerbProgressDto(dailyStudyDays, totalStudied, totalCorrect, accuracy);
    }
}