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
/// Records a "user A invited user B" link at the moment user B registers via the
/// /start ref_X deep-link. Does NOT grant any bonus to the referrer — that happens
/// later via TryActivateReferralService when B does something meaningful.
///
/// User B (referee) is rewarded immediately with extended trial — that's the
/// hook that makes them click in the first place.
/// </summary>
public class RecordReferralLinkService(ITraleDbContext db, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<RecordReferralLinkService>();

    public const int RefereeTrialBonusDays = 30;

    public async Task<RecordReferralLinkResult> ExecuteAsync(
        Guid newUserId, long referrerTelegramId, CancellationToken ct)
    {
        var newUser = await db.Users.FirstOrDefaultAsync(u => u.Id == newUserId, ct);
        if (newUser == null) return RecordReferralLinkResult.NewUserNotFound;

        // One referee — one referrer, ever.
        if (newUser.ReferredByUserId.HasValue) return RecordReferralLinkResult.AlreadyReferred;

        var referrer = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == referrerTelegramId, ct);
        if (referrer == null) return RecordReferralLinkResult.ReferrerNotFound;
        if (referrer.Id == newUser.Id) return RecordReferralLinkResult.SelfReferral;

        var now = DateTime.UtcNow;

        // Referee bonus: extended trial. We shift RegisteredAtUtc earlier so trialDaysLeft
        // calculation in GetMiniAppProfile gives more days.
        newUser.RegisteredAtUtc = newUser.RegisteredAtUtc.AddDays(-RefereeTrialBonusDays);
        newUser.ReferredByUserId = referrer.Id;

        db.Referrals.Add(new Referral
        {
            Id = Guid.NewGuid(),
            ReferrerUserId = referrer.Id,
            RefereeUserId = newUser.Id,
            CreatedAtUtc = now,
            ActivatedAtUtc = null,
            ActivationTrigger = null,
            BonusReferrerDays = 0,
            BonusRefereeDays = RefereeTrialBonusDays
        });

        await db.SaveChangesAsync(ct);
        _logger.LogInformation("Referral link recorded: {Referee} <- {Referrer}",
            newUser.Id, referrer.Id);
        return RecordReferralLinkResult.Recorded;
    }
}

public enum RecordReferralLinkResult
{
    Recorded,
    AlreadyReferred,
    NewUserNotFound,
    ReferrerNotFound,
    SelfReferral
}
