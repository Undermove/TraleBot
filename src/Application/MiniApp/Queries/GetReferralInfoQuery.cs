using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.MiniApp.Commands;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Queries;

/// <summary>
/// Data for the Profile screen "Invite a friend" card.
/// Deep-link URL is built by the controller (needs BotConfiguration.BotName).
/// </summary>
public class GetReferralInfoQuery(ITraleDbContext db)
{
    public async Task<GetReferralInfoResult?> ExecuteAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return null;

        var invited = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == userId, ct);
        var activated = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == userId && r.ActivatedAtUtc != null, ct);

        string bonusLabel;
        if (user.IsPro && user.SubscriptionPlan == SubscriptionPlan.Lifetime)
        {
            bonusLabel = "счётчик друзей (Lifetime — без бонуса)";
        }
        else if (user.IsPro)
        {
            bonusLabel = $"+{TryActivateReferralService.ReferrerProBonusDays} дней Pro за каждого активного друга";
        }
        else
        {
            bonusLabel = $"+{TryActivateReferralService.ReferrerTrialBonusDays} дней триала за каждого активного друга";
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
