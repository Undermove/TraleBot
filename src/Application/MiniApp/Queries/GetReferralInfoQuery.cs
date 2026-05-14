using System;
using System.Collections.Generic;
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

        var yearAgo = DateTime.UtcNow.AddDays(-365);
        var yearActivated = await db.Referrals
            .CountAsync(r => r.ReferrerUserId == userId
                          && r.ActivatedAtUtc != null
                          && r.ActivatedAtUtc >= yearAgo, ct);

        var now = DateTime.UtcNow;
        var isLifetime = user.IsLifetime;
        // Pro bonus is earned by anyone who ever bought Pro (excl. Lifetime) — including
        // expired-Pro users, whose +30d will reactivate their subscription.
        var earnsProBonus = user.IsPro && !isLifetime;
        var inviteeTotalTrial = User.TrialDays + RecordReferralLinkService.RefereeTrialBonusDays;
        var dailyCap = TryActivateReferralService.DailyActivationCap;
        var yearlyCap = TryActivateReferralService.YearlyActivationCap;
        var proBonus = TryActivateReferralService.ReferrerProBonusDays;
        var trialBonus = TryActivateReferralService.ReferrerTrialBonusDays;
        // "Cap reached" for hiding the card = non-Lifetime users who hit the yearly limit.
        var capReached = !isLifetime && yearActivated >= yearlyCap;

        // Short bonus label used by the trial banner / paywall CTA — matches the exact reward
        // the activator will hand out so banner copy never contradicts the rules section.
        var bonusShortLabel = isLifetime
            ? ""
            : earnsProBonus
                ? $"+{proBonus} дней Pro"
                : $"+{trialBonus} дней триала";

        // Rules rendered as a plain bullet list in the UI. Each entry = one line.
        var rules = new List<string>
        {
            $"Другу — {inviteeTotalTrial} дней триала вместо {User.TrialDays}."
        };
        if (isLifetime)
        {
            rules.Add("У тебя Lifetime — бонусы не начисляются, но счётчик приглашённых растёт.");
        }
        else
        {
            rules.Add($"Тебе — {bonusShortLabel} за каждого активного друга. Бонусы стакаются.");
            rules.Add("«Активный» — друг прошёл первый урок, добавил 5 слов или оформил подписку.");
            rules.Add($"Лимиты: до {dailyCap} друзей в день, до {yearlyCap} в год.");
        }

        return new GetReferralInfoResult
        {
            ReferrerTelegramId = user.TelegramId,
            InvitedCount = invited,
            ActivatedCount = activated,
            Rules = rules,
            BonusShortLabel = bonusShortLabel,
            CapReached = capReached
        };
    }
}

public class GetReferralInfoResult
{
    public long ReferrerTelegramId { get; init; }
    public int InvitedCount { get; init; }
    public int ActivatedCount { get; init; }
    public IReadOnlyList<string> Rules { get; init; } = new List<string>();
    /// <summary>Short bonus label matching what the activator awards ("+7 дней триала",
    /// "+30 дней Pro", or empty for Lifetime). Used by banner/paywall CTAs to keep
    /// the promise consistent with the rules section.</summary>
    public string BonusShortLabel { get; init; } = "";
    public bool CapReached { get; init; }
}
