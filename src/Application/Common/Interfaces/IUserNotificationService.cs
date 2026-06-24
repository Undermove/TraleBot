using Domain.Entities;

namespace Application.Common.Interfaces;

public interface IUserNotificationService
{
    Task NotifyAboutUnlockedAchievementAsync(Achievement achievement, CancellationToken ct);

    /// <summary>
    /// Send the D1+ retention push to the given user. The button opens the mini-app deep-linked
    /// to <paramref name="moduleId"/>/<paramref name="lessonId"/>. <paramref name="variant"/> picks
    /// the copy: "miss" (soft nudge), "module" (continue the module by name), "feed" (you have XP —
    /// feed Bombora) or "earn" (do a lesson to earn XP for a treat). <paramref name="availableXp"/>
    /// is the user's spendable XP (Xp − XpSpent), shown in the "feed" copy. If Telegram returns 403
    /// (user blocked the bot), the user is flagged inactive and the exception is swallowed; on 429
    /// the call retries once after the server-suggested delay.
    /// </summary>
    Task SendDailyReturnPushAsync(
        User user,
        string moduleName,
        string moduleId,
        int lessonId,
        string variant,
        int availableXp,
        CancellationToken ct);

    /// <summary>
    /// Streak-milestone push (epic #894, §82). <paramref name="milestone"/> is one of 7 / 30 / 100;
    /// the copy carries the matching Georgian numeral plus a methodist note (30 — vigesimal
    /// breakdown 20+10; 100 — contrast with the vigesimal tens). Mini-app button opens the host
    /// without a deep-link. 403 → user flagged inactive; 429 → single retry after the suggested
    /// delay, mirroring <see cref="SendDailyReturnPushAsync"/>.
    /// </summary>
    Task SendStreakMilestonePushAsync(User user, int milestone, CancellationToken ct);

    /// <summary>
    /// Coins-stale push (epic #894, §82, #994): the user has <paramref name="availableXp"/>
    /// spendable XP but hasn't fed Bombora in 7+ days. Body carries the «ბომბორა გახარდება»
    /// phrase with transliteration and translation; the WebApp button deep-links to
    /// <c>?screen=feed</c>. 403 → user flagged inactive; 429 → single retry after the
    /// suggested delay, mirroring <see cref="SendDailyReturnPushAsync"/>.
    /// </summary>
    Task SendCoinsStalePushAsync(User user, int availableXp, CancellationToken ct);
}