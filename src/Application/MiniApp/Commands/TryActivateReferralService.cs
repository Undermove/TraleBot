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
    private const int DailyActivationCapPerReferrer = 5;
    private const int YearlyActivationCapPerReferrer = 12;
    /// <summary>Trial/free users can only earn this many activations total — ever.
    /// 3 × 7 = 21 bonus days + 30 base trial ≈ 2 months free. After that, go Pro.</summary>
    public const int TrialLifetimeActivationCap = 3;

    public const int DailyActivationCap = DailyActivationCapPerReferrer;
    public const int YearlyActivationCap = YearlyActivationCapPerReferrer;

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

        // Anti-fraud: cap daily activations per referrer
        var startOfDay = now.Date;
        var todayActivations = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == referral.ReferrerUserId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= startOfDay, ct);
        if (todayActivations >= DailyActivationCapPerReferrer)
        {
            return TryActivateReferralResult.DailyCapReached;
        }

        // Anti-fraud: cap yearly activations per referrer
        var yearAgo = now.AddDays(-365);
        var yearActivations = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == referral.ReferrerUserId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= yearAgo, ct);
        if (yearActivations >= YearlyActivationCapPerReferrer)
        {
            return TryActivateReferralResult.YearlyCapReached;
        }

        var referrer = await db.Users.FirstOrDefaultAsync(u => u.Id == referral.ReferrerUserId, ct);
        if (referrer == null) return TryActivateReferralResult.ReferrerGone;

        // Trial/free users have a hard lifetime cap on activations (≈2 months free total)
        var isTrialOrFree = !referrer.IsPro;
        if (isTrialOrFree)
        {
            var totalActivations = await db.Referrals
                .CountAsync(r => r.ReferrerUserId == referral.ReferrerUserId
                              && r.ActivatedAtUtc != null, ct);
            if (totalActivations >= TrialLifetimeActivationCap)
            {
                return TryActivateReferralResult.TrialCapReached;
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
    DailyCapReached,
    YearlyCapReached,
    TrialCapReached,
    ReferrerGone
}
