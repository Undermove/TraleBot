using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.MiniApp;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Commands;

/// <summary>
/// Idempotent: call this whenever a user does something that should count as
/// "real engagement" — completing a lesson, adding their N-th vocab entry,
/// purchasing Pro. If the user has a pending referral and passes anti-fraud
/// checks, the referrer gets their bonus. Otherwise no-op.
/// </summary>
public class TryActivateReferralService(ITraleDbContext db, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<TryActivateReferralService>();

    public const int ReferrerProBonusDays = 30;
    public const int ReferrerTrialBonusDays = 7;
    private const int MinSecondsBetweenRegistrationAndActivation = 3600; // 1 hour
    private const int DailyActivationCapPerReferrer = 5;
    private const int YearlyActivationCapPerReferrer = 12;

    public async Task<TryActivateReferralResult> ExecuteAsync(
        Guid refereeUserId, string trigger, CancellationToken ct)
    {
        var referral = await db.Referrals
            .FirstOrDefaultAsync(r => r.RefereeUserId == refereeUserId && r.ActivatedAtUtc == null, ct);
        if (referral == null) return TryActivateReferralResult.NoPendingReferral;

        var now = DateTime.UtcNow;

        // Anti-fraud: require minimum lifetime between registration and activation
        // to defeat batch-fake "register then immediately activate" scripts.
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
            // Mark the referral as "saturated" — keep referee's trial bonus, just
            // skip the referrer reward. Don't activate so it can be reviewed.
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

        // Apply the referrer reward
        int days;
        if (referrer.IsPro && referrer.SubscriptionPlan == SubscriptionPlan.Lifetime)
        {
            // Lifetime gets nothing extra — counter only
            days = 0;
        }
        else if (referrer.IsPro && referrer.SubscribedUntil.HasValue)
        {
            days = ReferrerProBonusDays;
            referrer.SubscribedUntil = referrer.SubscribedUntil.Value.AddDays(days);
        }
        else
        {
            // Trial / free user — extend trial by shifting registration earlier
            days = ReferrerTrialBonusDays;
            referrer.RegisteredAtUtc = referrer.RegisteredAtUtc.AddDays(-days);
        }

        referral.ActivatedAtUtc = now;
        referral.ActivationTrigger = trigger;
        referral.BonusReferrerDays = days;

        await db.SaveChangesAsync(ct);

        _logger.LogInformation("Referral activated: {Referee} → {Referrer} +{Days}d via {Trigger}",
            refereeUserId, referrer.Id, days, trigger);
        return TryActivateReferralResult.Activated;
    }
}

public enum TryActivateReferralResult
{
    Activated,
    NoPendingReferral,
    TooEarly,
    DailyCapReached,
    YearlyCapReached,
    ReferrerGone
}
