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

    public const int ReferrerProBonusDays = 14;
    public const int ReferrerTrialBonusDays = 7;
    private const int MinSecondsBetweenRegistrationAndActivation = 3600; // 1 hour
    public const int DailyActivationCap = 5;
    public const int YearlyActivationCap = 6;

    public async Task<TryActivateReferralResult> ExecuteAsync(
        Referral referral, string trigger, CancellationToken ct)
        => (await ActivateAsync(referral, trigger, ct)).Result;

    /// <summary>Same as <see cref="ExecuteAsync"/>, but also says what the referrer was given —
    /// the caller uses it to tell the referrer.</summary>
    public async Task<ReferralActivation> ActivateAsync(
        Referral referral, string trigger, CancellationToken ct)
    {
        if (referral.ActivatedAtUtc != null) return new(TryActivateReferralResult.AlreadyActivated);

        var now = DateTime.UtcNow;

        // Anti-fraud: require minimum lifetime between registration and activation
        if ((now - referral.CreatedAtUtc).TotalSeconds < MinSecondsBetweenRegistrationAndActivation)
        {
            return new(TryActivateReferralResult.TooEarly);
        }

        // Anti-fraud: per-day and per-year activation caps per referrer.
        var startOfDay = now.Date;
        var todayActivations = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == referral.ReferrerUserId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= startOfDay, ct);
        if (todayActivations >= DailyActivationCap)
        {
            return new(TryActivateReferralResult.DailyCapReached);
        }

        var yearAgo = now.AddDays(-365);
        var yearActivations = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == referral.ReferrerUserId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= yearAgo, ct);
        if (yearActivations >= YearlyActivationCap)
        {
            return new(TryActivateReferralResult.YearlyCapReached);
        }

        var referrer = await db.Users.FirstOrDefaultAsync(u => u.Id == referral.ReferrerUserId, ct);
        if (referrer == null) return new(TryActivateReferralResult.ReferrerGone);

        // Apply the referrer reward. Anyone who's ever bought Pro (excl. Lifetime)
        // gets ReferrerProBonusDays — extends an active sub or reactivates a lapsed one.
        // Free users get ReferrerTrialBonusDays of free access that is always usable:
        // at the end of a running trial, or from now when the trial is already over.
        int days;
        var bonus = ReferralBonusKind.None;
        DateTime? accessUntil = null;
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
            bonus = ReferralBonusKind.ProExtended;
            accessUntil = referrer.SubscribedUntil;
        }
        else
        {
            days = ReferrerTrialBonusDays;
            // A week that changes nothing is a broken promise: for a trial that ended long ago
            // the days count from now (see User.GrantFreeAccessDays), never from registration.
            bonus = referrer.RegistrationTrialEndsAtUtc > now
                ? ReferralBonusKind.TrialExtended
                : ReferralBonusKind.FreeWeek;
            accessUntil = referrer.GrantFreeAccessDays(days, now);
        }

        referral.ActivatedAtUtc = now;
        referral.ActivationTrigger = trigger;
        referral.BonusReferrerDays = days;

        await db.SaveChangesAsync(ct);

        _logger.LogInformation("Referral activated: {Referee} → {Referrer} +{Days}d via {Trigger}",
            referral.RefereeUserId, referrer.Id, days, trigger);
        return new(TryActivateReferralResult.Activated, referrer, bonus, days, accessUntil);
    }
}

/// <summary>What the referrer received.</summary>
public enum ReferralBonusKind
{
    /// <summary>Nothing (Lifetime).</summary>
    None,
    /// <summary>Days added to the end of a trial that is still running.</summary>
    TrialExtended,
    /// <summary>The trial was over: free access counted from the activation
    /// (or added to a bonus period that is still running).</summary>
    FreeWeek,
    /// <summary>Paid subscription extended, or restarted from now if it had lapsed.</summary>
    ProExtended
}

/// <summary>Outcome of one activation attempt. <see cref="Referrer"/>, <see cref="Days"/> and
/// <see cref="AccessUntilUtc"/> are set only when <see cref="Result"/> is Activated.</summary>
public record ReferralActivation(
    TryActivateReferralResult Result,
    User? Referrer = null,
    ReferralBonusKind Bonus = ReferralBonusKind.None,
    int Days = 0,
    DateTime? AccessUntilUtc = null);

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
