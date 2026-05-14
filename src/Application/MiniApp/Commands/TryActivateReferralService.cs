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
    public const int DailyActivationCap = 5;
    public const int YearlyActivationCap = 12;

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

        // Anti-fraud: per-day and per-year activation caps per referrer.
        var startOfDay = now.Date;
        var todayActivations = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == referral.ReferrerUserId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= startOfDay, ct);
        if (todayActivations >= DailyActivationCap)
        {
            return TryActivateReferralResult.DailyCapReached;
        }

        var yearAgo = now.AddDays(-365);
        var yearActivations = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == referral.ReferrerUserId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= yearAgo, ct);
        if (yearActivations >= YearlyActivationCap)
        {
            return TryActivateReferralResult.YearlyCapReached;
        }

        var referrer = await db.Users.FirstOrDefaultAsync(u => u.Id == referral.ReferrerUserId, ct);
        if (referrer == null) return TryActivateReferralResult.ReferrerGone;

        // Apply the referrer reward. Anyone who's ever bought Pro (excl. Lifetime)
        // gets the +30d Pro bonus — extends an active sub or reactivates a lapsed one.
        // Free/trial users get +7d that accumulates into TrialBonusDays.
        int days;
        if (referrer.IsLifetime)
        {
            days = 0; // Lifetime gets nothing extra — counter only.
        }
        else if (referrer.IsPro)
        {
            days = ReferrerProBonusDays;
            // For active sub: extend from current expiry. For lapsed sub: restart from now,
            // effectively reactivating Pro access on the strength of the referral.
            var startFrom = referrer.SubscribedUntil.HasValue && referrer.SubscribedUntil.Value > now
                ? referrer.SubscribedUntil.Value
                : now;
            referrer.SubscribedUntil = startFrom.AddDays(days);
        }
        else
        {
            days = ReferrerTrialBonusDays;
            // Accumulate into TrialBonusDays — additive, stacks across activations
            // and survives trial expiry without rewriting the user's registration date.
            referrer.TrialBonusDays += days;
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
    ReferrerGone
}
