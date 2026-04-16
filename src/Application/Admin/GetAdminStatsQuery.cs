using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

/// <summary>
/// Aggregated stats for the owner-only admin screen. Service (not MediatR) per ARCHITECTURE.md.
/// </summary>
public class GetAdminStatsQuery(ITraleDbContext db)
{
    public async Task<AdminStatsDto> ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var d7 = now.AddDays(-7);
        var d30 = now.AddDays(-30);

        var users = db.Users;

        var total = await users.CountAsync(ct);
        var active = await users.CountAsync(u => u.IsActive, ct);
        var pro = await users.CountAsync(u => u.IsPro, ct);

        // Trial users = not Pro AND registered within trial window (30 days)
        var trial = await users.CountAsync(u => !u.IsPro && u.RegisteredAtUtc >= d30, ct);

        // Free (not pro, trial expired)
        var free = await users.CountAsync(u => !u.IsPro && u.RegisteredAtUtc < d30, ct);

        var newToday = await users.CountAsync(u => u.RegisteredAtUtc >= now.AddDays(-1), ct);
        var newWeek = await users.CountAsync(u => u.RegisteredAtUtc >= d7, ct);
        var newMonth = await users.CountAsync(u => u.RegisteredAtUtc >= d30, ct);

        // Payments / revenue
        var totalRevenue = await db.Payments
            .Where(p => p.RefundedAtUtc == null)
            .SumAsync(p => (long)p.Amount, ct);
        var revenueWeek = await db.Payments
            .Where(p => p.RefundedAtUtc == null && p.PurchasedAtUtc >= d7)
            .SumAsync(p => (long)p.Amount, ct);
        var purchases = await db.Payments.CountAsync(p => p.RefundedAtUtc == null, ct);
        var refunds = await db.Payments.CountAsync(p => p.RefundedAtUtc != null, ct);

        // Vocabulary
        var totalVocab = await db.VocabularyEntries.CountAsync(ct);
        var avgVocab = total > 0 ? Math.Round((double)totalVocab / total, 1) : 0;

        // Conversion: how many users that exited trial bought Pro
        var trialExited = await users.CountAsync(u => u.RegisteredAtUtc < d30, ct);
        var trialExitedAndPaid = await users.CountAsync(u => u.RegisteredAtUtc < d30 && u.IsPro, ct);
        var conversionPct = trialExited > 0
            ? Math.Round((double)trialExitedAndPaid / trialExited * 100, 1)
            : 0;

        return new AdminStatsDto
        {
            TotalUsers = total,
            ActiveUsers = active,
            ProUsers = pro,
            TrialUsers = trial,
            FreeUsers = free,
            NewUsersToday = newToday,
            NewUsersWeek = newWeek,
            NewUsersMonth = newMonth,
            TotalRevenueStars = totalRevenue,
            RevenueWeekStars = revenueWeek,
            TotalPurchases = purchases,
            TotalRefunds = refunds,
            TotalVocabularyEntries = totalVocab,
            AverageVocabularyPerUser = avgVocab,
            ConversionPostTrialPct = conversionPct
        };
    }
}

public class AdminStatsDto
{
    public int TotalUsers { get; init; }
    public int ActiveUsers { get; init; }
    public int ProUsers { get; init; }
    public int TrialUsers { get; init; }
    public int FreeUsers { get; init; }

    public int NewUsersToday { get; init; }
    public int NewUsersWeek { get; init; }
    public int NewUsersMonth { get; init; }

    public long TotalRevenueStars { get; init; }
    public long RevenueWeekStars { get; init; }
    public int TotalPurchases { get; init; }
    public int TotalRefunds { get; init; }

    public int TotalVocabularyEntries { get; init; }
    public double AverageVocabularyPerUser { get; init; }

    public double ConversionPostTrialPct { get; init; }
}
