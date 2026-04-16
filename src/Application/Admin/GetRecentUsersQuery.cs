using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

public enum RecentUsersSort
{
    RecentSignup,
    RecentActivity,
    VocabularyCount
}

/// <summary>
/// Recent users with optional Telegram ID search and sort by last activity.
/// </summary>
public class GetRecentUsersQuery(ITraleDbContext db)
{
    public async Task<List<RecentUserDto>> ExecuteAsync(
        int limit,
        string? search,
        RecentUsersSort sort,
        CancellationToken ct)
    {
        if (limit <= 0) limit = 20;
        if (limit > 200) limit = 200;

        var q = db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.Trim();
            // Match TelegramId by string contains (so partial numeric search works)
            q = q.Where(u => u.TelegramId.ToString().Contains(search));
        }

        // For sorts that depend on enriched columns (activity / vocab count) we need
        // a wider candidate window before trimming to `limit` after computing them.
        var fetchLimit = sort == RecentUsersSort.RecentSignup ? limit : Math.Min(limit * 5, 500);

        // For VocabularyCount sort, prime the candidate window by vocab count
        // straight from the DB so we don't accidentally trim the heaviest users.
        var primedQuery = sort == RecentUsersSort.VocabularyCount
            ? q.OrderByDescending(u => db.VocabularyEntries.Count(v => v.UserId == u.Id))
            : q.OrderByDescending(u => u.RegisteredAtUtc);

        var candidates = await primedQuery
            .Take(fetchLimit)
            .Select(u => new
            {
                u.Id,
                u.TelegramId,
                u.IsPro,
                u.SubscriptionPlan,
                u.SubscribedUntil,
                u.RegisteredAtUtc,
                u.ProPurchasedAtUtc,
                VocabCount = db.VocabularyEntries.Count(v => v.UserId == u.Id),
                LastVocab = db.VocabularyEntries
                    .Where(v => v.UserId == u.Id)
                    .Max(v => (DateTime?)v.DateAddedUtc),
                LastQuiz = db.Quizzes
                    .Where(qz => qz.UserId == u.Id)
                    .Max(qz => (DateTime?)qz.DateStarted),
                LastPlayed = db.MiniAppUserProgresses
                    .Where(p => p.UserId == u.Id)
                    .Max(p => (DateTime?)p.LastPlayedAtUtc)
            })
            .ToListAsync(ct);

        var enriched = candidates.Select(u => new RecentUserDto
        {
            TelegramId = u.TelegramId,
            IsPro = u.IsPro,
            Plan = u.SubscriptionPlan?.ToString(),
            SubscribedUntilUtc = u.SubscribedUntil,
            RegisteredAtUtc = u.RegisteredAtUtc,
            ProPurchasedAtUtc = u.ProPurchasedAtUtc,
            VocabularyCount = u.VocabCount,
            LastActivityUtc = MaxNullable(u.LastVocab, u.LastQuiz, u.LastPlayed)
        });

        if (sort == RecentUsersSort.RecentActivity)
        {
            enriched = enriched.OrderByDescending(u => u.LastActivityUtc ?? DateTime.MinValue);
        }
        else if (sort == RecentUsersSort.VocabularyCount)
        {
            enriched = enriched.OrderByDescending(u => u.VocabularyCount);
        }

        return enriched.Take(limit).ToList();
    }

    private static DateTime? MaxNullable(params DateTime?[] values)
    {
        DateTime? max = null;
        foreach (var v in values)
        {
            if (v.HasValue && (!max.HasValue || v.Value > max.Value)) max = v;
        }
        return max;
    }
}

public class RecentUserDto
{
    public long TelegramId { get; init; }
    public bool IsPro { get; init; }
    public string? Plan { get; init; }
    public DateTime? SubscribedUntilUtc { get; init; }
    public DateTime RegisteredAtUtc { get; init; }
    public DateTime? ProPurchasedAtUtc { get; init; }
    public int VocabularyCount { get; init; }
    public DateTime? LastActivityUtc { get; init; }
}
