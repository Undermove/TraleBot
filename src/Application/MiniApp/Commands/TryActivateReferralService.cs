using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Commands;

/// <summary>
/// Idempotent: call for each pending referral when the referee meets an
/// activation trigger. If anti-fraud checks pass, the referrer gets their bonus.
/// Otherwise no-op.
/// </summary>
public class TryActivateReferralService(ITraleDbContext db, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<TryActivateReferralService>();

    public const int ReferrerProBonusDays = 30;
    public const int ReferrerTrialBonusDays = 7;
    private const int MinSecondsBetweenRegistrationAndActivation = 3600; // 1 hour
    /// <summary>Hard lifetime cap on bonus-earning activations per referrer.
    /// Lifetime-plan users are exempt (they earn no bonus anyway).</summary>
    public const int LifetimeActivationCap = 3;

    public async Task<TryActivateReferralResult> ExecuteAsync(
        Referral referral, string trigger, CancellationToken ct)
    {
        if (referral.ActivatedAtUtc != null) return TryActivateReferralResult.AlreadyActivated;

        var now = DateTime.UtcNow;

        // Anti-fraud: require minimum lifetime between registration and activation
        if ((now - referral.CreatedAtUtc).TotalSeconds < MinSecondsBetweenRegistrationAndActivation)
        {
            return TryActivateReferralResult.TooEarly;
        }

        var referrer = await db.Users.FirstOrDefaultAsync(u => u.Id == referral.ReferrerUserId, ct);
        if (referrer == null) return TryActivateReferralResult.ReferrerGone;

        // Hard lifetime cap of 3 bonus-earning activations. Lifetime users are exempt
        // because they earn zero bonus — the counter is informational only for them.
        var isLifetime = referrer.IsPro && referrer.SubscriptionPlan == SubscriptionPlan.Lifetime;
        if (!isLifetime)
        {
            var totalActivations = await db.Referrals
                .CountAsync(r => r.ReferrerUserId == referral.ReferrerUserId
                              && r.ActivatedAtUtc != null, ct);
            if (totalActivations >= LifetimeActivationCap)
            {
                return TryActivateReferralResult.LifetimeCapReached;
            }
        }

        // Apply the referrer reward
        int days;
        if (referrer.IsPro && referrer.SubscriptionPlan == SubscriptionPlan.Lifetime)
        {
            days = 0; // Lifetime gets nothing extra — counter only
        }
        else if (referrer.IsPro && referrer.SubscribedUntil.HasValue)
        {
            days = ReferrerProBonusDays;
            referrer.SubscribedUntil = referrer.SubscribedUntil.Value.AddDays(days);
        }
        else
        {
            days = ReferrerTrialBonusDays;
            referrer.RegisteredAtUtc = referrer.RegisteredAtUtc.AddDays(-days);
        }

        referral.ActivatedAtUtc = now;
        referral.ActivationTrigger = trigger;
        referral.BonusReferrerDays = days;

        await db.SaveChangesAsync(ct);

        _logger.LogInformation("Referral activated: {Referee} → {Referrer} +{Days}d via {Trigger}",
            referral.RefereeUserId, referrer.Id, days, trigger);
        return TryActivateReferralResult.Activated;
    }
}

public enum TryActivateReferralResult
{
    Activated,
    AlreadyActivated,
    NoPendingReferral,
    TooEarly,
    LifetimeCapReached,
    ReferrerGone
}
