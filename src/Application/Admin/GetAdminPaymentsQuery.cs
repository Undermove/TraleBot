using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

/// <summary>
/// Payments, newest first, page by page — and the subscriptions about to end or just ended: the
/// people worth a word before or after they lapse.
/// </summary>
public class GetAdminPaymentsQuery(ITraleDbContext db)
{
    public const int EndingSoonDays = 14;
    public const int EndedLatelyDays = 30;

    public async Task<AdminPaymentsDto> ExecuteAsync(int skip, int take, CancellationToken ct)
    {
        take = Math.Clamp(take, 1, 100);
        skip = Math.Max(skip, 0);
        var now = DateTime.UtcNow;

        var payments = db.Payments.AsNoTracking();
        var page = await payments
            .OrderByDescending(p => p.PurchasedAtUtc)
            .Skip(skip).Take(take)
            .Join(db.Users, p => p.UserId, u => u.Id, (p, u) => new AdminPaymentRow(
                u.TelegramId, p.PurchasedAtUtc, p.Plan.ToString(), p.Amount, p.Currency, p.RefundedAtUtc))
            .ToListAsync(ct);

        var subscribers = await db.Users.AsNoTracking()
            .Where(u => u.IsPro && u.SubscribedUntil != null
                        && u.SubscribedUntil > now.AddDays(-EndedLatelyDays) && u.SubscribedUntil < now.AddDays(EndingSoonDays))
            .Select(u => new AdminSubscriptionRow(u.TelegramId, u.SubscriptionPlan.ToString(), u.SubscribedUntil!.Value))
            .ToListAsync(ct);

        return new AdminPaymentsDto
        {
            Total = await payments.CountAsync(ct),
            Payments = page.OrderByDescending(p => p.PurchasedAtUtc).ToList(),
            StarsTotal = await payments.Where(p => p.RefundedAtUtc == null).SumAsync(p => (long)p.Amount, ct),
            Refunds = await payments.CountAsync(p => p.RefundedAtUtc != null, ct),
            EndingSoon = subscribers.Where(s => s.UntilUtc > now).OrderBy(s => s.UntilUtc).ToList(),
            EndedLately = subscribers.Where(s => s.UntilUtc <= now).OrderByDescending(s => s.UntilUtc).ToList()
        };
    }
}

public record AdminPaymentRow(long TelegramId, DateTime PurchasedAtUtc, string Plan, int Amount, string Currency, DateTime? RefundedAtUtc);

public record AdminSubscriptionRow(long TelegramId, string? Plan, DateTime UntilUtc);

public class AdminPaymentsDto
{
    public int Total { get; init; }
    public IReadOnlyList<AdminPaymentRow> Payments { get; init; } = [];
    /// <summary>Stars received over all time, refunds not counted.</summary>
    public long StarsTotal { get; init; }
    public int Refunds { get; init; }
    /// <summary>Active subscriptions that end within <see cref="GetAdminPaymentsQuery.EndingSoonDays"/> days.</summary>
    public IReadOnlyList<AdminSubscriptionRow> EndingSoon { get; init; } = [];
    /// <summary>Subscriptions that ended within the last <see cref="GetAdminPaymentsQuery.EndedLatelyDays"/> days.</summary>
    public IReadOnlyList<AdminSubscriptionRow> EndedLately { get; init; } = [];
}
