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
        var hasActivePro = user.HasActivePro(now);
        var inviteeTotalTrial = User.TrialDays + RecordReferralLinkService.RefereeTrialBonusDays;
        var dailyCap = TryActivateReferralService.DailyActivationCap;
        var yearlyCap = TryActivateReferralService.YearlyActivationCap;
        var proBonus = TryActivateReferralService.ReferrerProBonusDays;
        var trialBonus = TryActivateReferralService.ReferrerTrialBonusDays;
        // "Cap reached" for hiding the card = non-Lifetime users who hit the yearly limit.
        var capReached = !isLifetime && yearActivated >= yearlyCap;

        // Rules rendered as a plain bullet list in the UI. Each entry = one line.
        var rules = new List<string>
        {
            $"Друг получит {inviteeTotalTrial} дней триала вместо {User.TrialDays}."
        };
        if (isLifetime)
        {
            rules.Add("У тебя Lifetime — бонус не начисляется, но счётчик приглашённых растёт.");
        }
        else
        {
            // Pro-expired users earn the trial-style bonus, matching the activator logic.
            var yourBonus = hasActivePro
                ? $"+{proBonus} дней Pro"
                : $"+{trialBonus} дней триала";
            rules.Add($"Ты получишь {yourBonus} за каждого активного друга. Бонусы стакаются.");
            rules.Add("Активным считается тот, кто прошёл первый урок или добавил 5 слов.");
            rules.Add($"Можно пригласить до {dailyCap} друзей в день, до {yearlyCap} в год.");
        }

        return new GetReferralInfoResult
        {
            ReferrerTelegramId = user.TelegramId,
            InvitedCount = invited,
            ActivatedCount = activated,
            Rules = rules,
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
    public bool CapReached { get; init; }
}
