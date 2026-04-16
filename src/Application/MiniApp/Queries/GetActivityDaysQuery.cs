using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Queries;

/// <summary>
/// Activity timestamps for the user's profile streak heatmap.
/// "Active" = the user did at least one of: added a vocabulary entry, started
/// a quiz, played the mini-app on that day. Returns raw UTC timestamps so the
/// frontend can group them by the USER'S local date (avoids the off-by-one
/// where, e.g., a Tbilisi user playing at 02:00 lights up "yesterday" UTC).
/// Service per ARCHITECTURE.md.
/// </summary>
public class GetActivityDaysQuery(ITraleDbContext db)
{
    public async Task<List<string>> ExecuteAsync(Guid userId, int days, CancellationToken ct)
    {
        if (days <= 0) days = 30;
        if (days > 365) days = 365;

        // Look back by `days + 1` UTC days so off-by-one across midnight doesn't
        // cut off legitimately-yesterday-local activity.
        var since = DateTime.UtcNow.Date.AddDays(-(days + 1));

        var vocabDates = await db.VocabularyEntries
            .Where(v => v.UserId == userId && v.DateAddedUtc >= since)
            .Select(v => v.DateAddedUtc)
            .ToListAsync(ct);

        var quizDates = await db.Quizzes
            .Where(q => q.UserId == userId && q.DateStarted >= since)
            .Select(q => q.DateStarted)
            .ToListAsync(ct);

        var lastPlayed = await db.MiniAppUserProgresses
            .Where(p => p.UserId == userId && p.LastPlayedAtUtc != null && p.LastPlayedAtUtc >= since)
            .Select(p => p.LastPlayedAtUtc)
            .ToListAsync(ct);

        var achievementDates = await db.Achievements
            .Where(a => a.UserId == userId && a.DateAddedUtc >= since)
            .Select(a => a.DateAddedUtc)
            .ToListAsync(ct);

        var all = vocabDates
            .Concat(quizDates)
            .Concat(lastPlayed.Where(d => d.HasValue).Select(d => d!.Value))
            .Concat(achievementDates);

        // Return ISO 8601 timestamps with explicit UTC marker. Frontend converts
        // to user's local date for the heatmap.
        return all
            .OrderBy(d => d)
            .Select(d => DateTime.SpecifyKind(d, DateTimeKind.Utc).ToString("yyyy-MM-ddTHH:mm:ssZ"))
            .ToList();
    }
}
