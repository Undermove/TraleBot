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
        var state = ResolveState(user, now);
        var inviteeTotalTrial = User.TrialDays + RecordReferralLinkService.RefereeTrialBonusDays;
        var dailyCap = TryActivateReferralService.DailyActivationCap;
        var yearlyCap = TryActivateReferralService.YearlyActivationCap;
        var proBonus = TryActivateReferralService.ReferrerProBonusDays;
        var trialBonus = TryActivateReferralService.ReferrerTrialBonusDays;
        // "Cap reached" for hiding the card = non-Lifetime users who hit the yearly limit.
        var capReached = state != ReferralOfferState.Lifetime && yearActivated >= yearlyCap;

        // What the activator hands out in each state — the copy below must say exactly that,
        // see TryActivateReferralService. Plain words: «пробный период», never «триал».
        var (bonusShortLabel, inviteLine, ruleForMe) = state switch
        {
            ReferralOfferState.Trial => (
                $"+{trialBonus} дней к пробному",
                $"Позови друга — получишь +{trialBonus} дней к пробному периоду",
                $"Тебе — +{trialBonus} дней к пробному периоду за каждого друга, который начал заниматься."),
            ReferralOfferState.AccessEnded => (
                "неделя доступа",
                "Позови друга — получишь неделю доступа",
                "Тебе — неделя доступа за каждого друга, который начал заниматься. " +
                "Неделя идёт с того дня, когда друг начал; позовёшь ещё одного — продлится на столько же."),
            ReferralOfferState.Pro => (
                $"+{proBonus} дней подписки",
                $"Позови друга — получишь +{proBonus} дней подписки",
                $"Тебе — +{proBonus} дней подписки за каждого друга, который начал заниматься."),
            _ => ("", "", "У тебя подписка навсегда, так что бонус тебе не нужен — но друг свои дни получит.")
        };

        // Rules rendered as a plain bullet list in the UI. Each entry = one line.
        var rules = new List<string>
        {
            $"Другу — {inviteeTotalTrial} дней бесплатно вместо {User.TrialDays}, если он раньше не пользовался TraleBot.",
            ruleForMe
        };
        if (state != ReferralOfferState.Lifetime)
        {
            rules.Add("«Начал заниматься» — прошёл первый урок, добавил 5 слов или купил подписку. " +
                      "Бонус приходит не раньше чем через час после того, как друг зашёл.");
            rules.Add($"Не больше {dailyCap} друзей в день и {yearlyCap} в год.");
        }

        return new GetReferralInfoResult
        {
            ReferrerTelegramId = user.TelegramId,
            InvitedCount = invited,
            ActivatedCount = activated,
            Rules = rules,
            State = state,
            BonusShortLabel = bonusShortLabel,
            InviteLine = inviteLine,
            ShareText = $"Учу грузинский в TraleBot 🇬🇪 Заходи по моей ссылке — тебе дадут {inviteeTotalTrial} дней бесплатно вместо {User.TrialDays}.",
            CapReached = capReached
        };
    }

    /// <summary>Which reward the activator would give this user right now. Mirrors the branches
    /// of <see cref="TryActivateReferralService"/>: Lifetime → nothing, ever paid → subscription
    /// days, trial still running → days at its end, otherwise → a week from the activation.</summary>
    public static ReferralOfferState ResolveState(User user, DateTime now)
    {
        if (user.IsLifetime) return ReferralOfferState.Lifetime;
        if (user.IsPro) return ReferralOfferState.Pro;
        return user.HasActiveTrial(now) ? ReferralOfferState.Trial : ReferralOfferState.AccessEnded;
    }
}

public enum ReferralOfferState
{
    Trial,
    AccessEnded,
    Pro,
    Lifetime
}

public class GetReferralInfoResult
{
    public long ReferrerTelegramId { get; init; }
    public int InvitedCount { get; init; }
    public int ActivatedCount { get; init; }
    public IReadOnlyList<string> Rules { get; init; } = new List<string>();
    public ReferralOfferState State { get; init; }
    /// <summary>Short name of the reward the activator gives in the user's current state
    /// («+7 дней к пробному», «неделя доступа», «+14 дней подписки»; empty for Lifetime).</summary>
    public string BonusShortLabel { get; init; } = "";
    /// <summary>One ready sentence for an invite entry («Позови друга — получишь неделю доступа»);
    /// empty for Lifetime. The UI shows it as is, so the grammar never breaks.</summary>
    public string InviteLine { get; init; } = "";
    /// <summary>The message a user sends to a friend together with the link.</summary>
    public string ShareText { get; init; } = "";
    public bool CapReached { get; init; }
}
