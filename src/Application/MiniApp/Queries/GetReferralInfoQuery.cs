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

        var isLifetime = user.IsPro && user.SubscriptionPlan == SubscriptionPlan.Lifetime;
        var inviteeTotalTrial = User.TrialDays + RecordReferralLinkService.RefereeTrialBonusDays;
        var lifetimeCap = TryActivateReferralService.LifetimeActivationCap;
        var proBonus = TryActivateReferralService.ReferrerProBonusDays;
        var trialBonus = TryActivateReferralService.ReferrerTrialBonusDays;
        var capReached = !isLifetime && activated >= lifetimeCap;

        // Single self-contained sentence describing who gets what.
        string bonusLabel = isLifetime
            ? $"Другу — {inviteeTotalTrial} дней триала вместо {User.TrialDays}. У тебя Lifetime — бонусы не начисляются, но счётчик приглашённых растёт."
            : user.IsPro
                ? $"Другу — {inviteeTotalTrial} дней триала вместо {User.TrialDays}. Тебе — +{proBonus} дней Pro, когда друг пройдёт первый урок или добавит 5 слов."
                : $"Другу — {inviteeTotalTrial} дней триала вместо {User.TrialDays}. Тебе — +{trialBonus} дней триала, когда друг пройдёт первый урок или добавит 5 слов.";

        // Cap line — null hides the line in UI.
        string? limitsLabel;
        if (isLifetime)
        {
            limitsLabel = null;
        }
        else
        {
            limitsLabel = capReached
                ? $"Максимум бонусов получен ({lifetimeCap} друга)."
                : $"Бонус начисляется за первых {lifetimeCap} друзей.";
        }

        return new GetReferralInfoResult
        {
            ReferrerTelegramId = user.TelegramId,
            InvitedCount = invited,
            ActivatedCount = activated,
            BonusLabel = bonusLabel,
            LimitsLabel = limitsLabel,
            LifetimeCap = lifetimeCap,
            CapReached = capReached
        };
    }
}

public class GetReferralInfoResult
{
    public long ReferrerTelegramId { get; init; }
    public int InvitedCount { get; init; }
    public int ActivatedCount { get; init; }
    public string BonusLabel { get; init; } = "";
    public string? LimitsLabel { get; init; }
    public int LifetimeCap { get; init; }
    public bool CapReached { get; init; }
}
