using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp;

/// <summary>
/// Prices go up on <see cref="RiseAtUtc"/> — 1 December 2026, 00:00 Tbilisi — from
/// <see cref="SubscriptionPlanInfo.StarsPrice"/> to <see cref="SubscriptionPlans.RaisedPrice"/> (about +50%).
/// Whoever paid before that keeps the old prices for good: a thank-you to the first buyers.
/// Until the rise everybody pays the old prices and the paywall says when they go up.
/// </summary>
public class PriceSchedule
{
    public static readonly DateTime DefaultRiseAtUtc = new(2026, 11, 30, 20, 0, 0, DateTimeKind.Utc);

    public DateTime RiseAtUtc { get; init; } = DefaultRiseAtUtc;

    public bool HasRisen(DateTime nowUtc) => nowUtc >= RiseAtUtc;

    /// <summary>A payment before the rise that was not refunded — the old prices stay for this person.</summary>
    public Task<bool> KeepsOldPricesAsync(ITraleDbContext db, Guid userId, CancellationToken ct) =>
        db.Payments.AnyAsync(p => p.UserId == userId && p.RefundedAtUtc == null && p.PurchasedAtUtc < RiseAtUtc, ct);

    /// <summary>What this person pays for the plan now.</summary>
    public int PriceFor(SubscriptionPlanInfo plan, DateTime nowUtc, bool keepsOldPrices) =>
        keepsOldPrices || !HasRisen(nowUtc) ? plan.StarsPrice : SubscriptionPlans.RaisedPrice(plan);
}
