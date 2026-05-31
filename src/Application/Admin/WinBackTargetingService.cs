using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

public record WinBackCandidate(Guid UserId, long TelegramId);

public class WinBackTargetingService(ITraleDbContext db)
{
    public async Task<IReadOnlyList<WinBackCandidate>> GetEligibleUsersAsync(
        DateTime cohortAfter,
        DateTime cohortBefore,
        int inactiveSinceDays,
        CancellationToken ct)
    {
        var threshold = DateTime.UtcNow.AddDays(-inactiveSinceDays);

        // Pull candidates with per-source activity maxima via correlated subqueries.
        // The final filter (max-across-sources vs threshold) is done in memory because
        // computing GREATEST of three nullable DateTimes portably across providers is
        // more readable in C# than in LINQ-to-SQL.
        var candidates = await db.Users
            .Where(u => u.IsActive
                     && u.RegisteredAtUtc >= cohortAfter
                     && u.RegisteredAtUtc < cohortBefore
                     && u.WinBackSentAtUtc == null)
            .Select(u => new
            {
                u.Id,
                u.TelegramId,
                LastMiniApp = db.MiniAppUserProgresses
                    .Where(p => p.UserId == u.Id && p.LastPlayedAtUtc != null)
                    .Max(p => (DateTime?)p.LastPlayedAtUtc),
                LastQuiz = db.Quizzes
                    .Where(q => q.UserId == u.Id)
                    .Max(q => (DateTime?)q.DateStarted),
                LastVocab = db.VocabularyEntries
                    .Where(v => v.UserId == u.Id)
                    .Max(v => (DateTime?)v.DateAddedUtc)
            })
            .ToListAsync(ct);

        return candidates
            .Where(x =>
            {
                var activities = new[] { x.LastMiniApp, x.LastQuiz, x.LastVocab }
                    .Where(d => d.HasValue)
                    .Select(d => d!.Value)
                    .ToList();

                // No activity records at all → dormant by definition
                if (activities.Count == 0) return true;

                // Most recent activity must be older than threshold
                return activities.Max() < threshold;
            })
            .Select(x => new WinBackCandidate(x.Id, x.TelegramId))
            .ToList();
    }
}
