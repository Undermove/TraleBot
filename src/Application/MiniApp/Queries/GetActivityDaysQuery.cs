using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Queries;

/// <summary>
/// Activity days for the user's profile streak heatmap.
/// "Active" = the user did at least one of: added a vocabulary entry, started
/// a quiz, played the mini-app on that day. Service per ARCHITECTURE.md.
/// </summary>
public class GetActivityDaysQuery(ITraleDbContext db)
{
    public async Task<List<string>> ExecuteAsync(Guid userId, int days, CancellationToken ct)
    {
        if (days <= 0) days = 30;
        if (days > 365) days = 365;

        var since = DateTime.UtcNow.Date.AddDays(-days + 1);

        // Vocabulary added
        var vocabDates = await db.VocabularyEntries
            .Where(v => v.UserId == userId && v.DateAddedUtc >= since)
            .Select(v => v.DateAddedUtc)
            .ToListAsync(ct);

        // Quizzes started (chat-bot quizzes)
        var quizDates = await db.Quizzes
            .Where(q => q.UserId == userId && q.DateStarted >= since)
            .Select(q => q.DateStarted)
            .ToListAsync(ct);

        // Mini-app last play — single point, but at least covers today/yesterday
        var lastPlayed = await db.MiniAppUserProgresses
            .Where(p => p.UserId == userId && p.LastPlayedAtUtc != null && p.LastPlayedAtUtc >= since)
            .Select(p => p.LastPlayedAtUtc)
            .ToListAsync(ct);

        // Achievements earned
        var achievementDates = await db.Achievements
            .Where(a => a.UserId == userId && a.DateAddedUtc >= since)
            .Select(a => a.DateAddedUtc)
            .ToListAsync(ct);

        var all = vocabDates
            .Concat(quizDates)
            .Concat(lastPlayed.Where(d => d.HasValue).Select(d => d!.Value))
            .Concat(achievementDates);

        return all
            .Select(d => d.Date)
            .Distinct()
            .OrderBy(d => d)
            .Select(d => d.ToString("yyyy-MM-dd"))
            .ToList();
    }
}
