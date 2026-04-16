using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Queries;

/// <summary>
/// Data for the Profile screen "Invite a friend" card. Returns the user's
/// referral telegram-id (used to build the deep-link), counts of pending
/// vs activated referrals, and the bonus the referrer would currently earn
/// (varies: lifetime owner = nothing, Pro = +30 days, free = +7 trial days).
/// The deep-link URL itself is built by the controller because it needs
/// BotConfiguration.BotName from Infrastructure.
/// </summary>
public class GetReferralInfoQuery(ITraleDbContext db)
{
    public async Task<GetReferralInfoResult?> ExecuteAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return null;

        var invited = await db.Referrals
            .Where(r => r.ReferrerUserId == userId)
            .CountAsync(ct);
        var activated = await db.Referrals
            .Where(r => r.ReferrerUserId == userId && r.ActivatedAtUtc != null)
            .CountAsync(ct);

        // What the user gets per successful activation, given their current state.
        // Mirrors the branching in TryActivateReferralService.
        string bonusLabel;
        if (user.IsPro && user.SubscriptionPlan == Domain.Entities.SubscriptionPlan.Lifetime)
        {
            bonusLabel = "счётчик друзей (Lifetime — без бонуса)";
        }
        else if (user.IsPro)
        {
            bonusLabel = $"+{Commands.TryActivateReferralService.ReferrerProBonusDays} дней Pro за каждого активного друга";
        }
        else
        {
            bonusLabel = $"+{Commands.TryActivateReferralService.ReferrerTrialBonusDays} дней триала за каждого активного друга";
        }

        return new GetReferralInfoResult
        {
            ReferrerTelegramId = user.TelegramId,
            InvitedCount = invited,
            ActivatedCount = activated,
            BonusLabel = bonusLabel
        };
    }
}

public class GetReferralInfoResult
{
    public long ReferrerTelegramId { get; init; }
    public int InvitedCount { get; init; }
    public int ActivatedCount { get; init; }
    public string BonusLabel { get; init; } = "";
}
