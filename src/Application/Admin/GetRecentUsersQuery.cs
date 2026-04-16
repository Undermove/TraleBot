using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

/// <summary>
/// Most-recent users for the admin overview table.
/// </summary>
public class GetRecentUsersQuery(ITraleDbContext db)
{
    public async Task<List<RecentUserDto>> ExecuteAsync(int limit, CancellationToken ct)
    {
        if (limit <= 0) limit = 20;
        if (limit > 100) limit = 100;

        var users = await db.Users
            .OrderByDescending(u => u.RegisteredAtUtc)
            .Take(limit)
            .Select(u => new
            {
                u.Id,
                u.TelegramId,
                u.IsPro,
                u.SubscriptionPlan,
                u.SubscribedUntil,
                u.RegisteredAtUtc,
                u.ProPurchasedAtUtc,
                VocabCount = db.VocabularyEntries.Count(v => v.UserId == u.Id)
            })
            .ToListAsync(ct);

        return users.Select(u => new RecentUserDto
        {
            TelegramId = u.TelegramId,
            IsPro = u.IsPro,
            Plan = u.SubscriptionPlan?.ToString(),
            SubscribedUntilUtc = u.SubscribedUntil,
            RegisteredAtUtc = u.RegisteredAtUtc,
            ProPurchasedAtUtc = u.ProPurchasedAtUtc,
            VocabularyCount = u.VocabCount
        }).ToList();
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
}
