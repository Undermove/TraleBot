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

        var todayActivated = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == userId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= DateTime.UtcNow.Date, ct);

        var yearAgo = DateTime.UtcNow.AddDays(-365);
        var yearActivated = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == userId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= yearAgo, ct);

        var isLifetime = user.IsPro && user.SubscriptionPlan == SubscriptionPlan.Lifetime;
        var isTrialOrFree = !user.IsPro;
        var inviteeTotalTrial = User.TrialDays + RecordReferralLinkService.RefereeTrialBonusDays;
        var dailyCap = TryActivateReferralService.DailyActivationCap;
        var yearlyCap = TryActivateReferralService.YearlyActivationCap;
        var trialCap = TryActivateReferralService.TrialLifetimeActivationCap;
        var proBonus = TryActivateReferralService.ReferrerProBonusDays;
        var trialBonus = TryActivateReferralService.ReferrerTrialBonusDays;
        var trialCapReached = isTrialOrFree && activated >= trialCap;

        // Single self-contained sentence describing who gets what.
        string bonusLabel = isLifetime
            ? $"Другу — {inviteeTotalTrial} дней триала вместо {User.TrialDays}. У тебя Lifetime — бонусы не начисляются, но счётчик приглашённых растёт."
            : user.IsPro
                ? $"Другу — {inviteeTotalTrial} дней триала вместо {User.TrialDays}. Тебе — +{proBonus} дней Pro, когда друг пройдёт первый урок или добавит 5 слов."
                : $"Другу — {inviteeTotalTrial} дней триала вместо {User.TrialDays}. Тебе — +{trialBonus} дней триала, когда друг пройдёт первый урок или добавит 5 слов.";

        // Cap line — state-specific. Null hides the line in UI.
        string? limitsLabel;
        if (isLifetime)
        {
            limitsLabel = null;
        }
        else if (isTrialOrFree)
        {
            limitsLabel = trialCapReached
                ? $"Максимум бонусов получен ({trialCap} друга). Оформи Pro — и получай +{proBonus} дней за каждого следующего."
                : $"Бонус начисляется за первых {trialCap} друзей. Дальше — оформи Pro, и бонусы продолжатся.";
        }
        else if (todayActivated >= dailyCap)
        {
            limitsLabel = "Дневной лимит достигнут, бонусы продолжатся завтра.";
        }
        else
        {
            limitsLabel = $"До {dailyCap} друзей в день · до {yearlyCap} в год.";
        }

        return new GetReferralInfoResult
        {
            ReferrerTelegramId = user.TelegramId,
            InvitedCount = invited,
            ActivatedCount = activated,
            BonusLabel = bonusLabel,
            LimitsLabel = limitsLabel,
            TodayActivated = todayActivated,
            DailyLimit = dailyCap,
            YearActivated = yearActivated,
            YearlyLimit = yearlyCap,
            TrialCapReached = trialCapReached,
            TrialLimit = trialCap
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
    public int TodayActivated { get; init; }
    public int DailyLimit { get; init; }
    public int YearActivated { get; init; }
    public int YearlyLimit { get; init; }
    public bool TrialCapReached { get; init; }
    public int TrialLimit { get; init; }
}
