using Domain.Entities;

namespace Application.Common.Interfaces;

public interface IUserNotificationService
{
    Task NotifyAboutUnlockedAchievementAsync(Achievement achievement, CancellationToken ct);

    /// <summary>
    /// Send the D1+ retention push to the given user. The button opens the mini-app deep-linked
    /// to <paramref name="moduleId"/>/<paramref name="lessonId"/>. <paramref name="variant"/> is
    /// the A/B copy variant chosen upstream (#951). If Telegram returns 403 (user blocked the bot),
    /// the user is flagged inactive and the exception is swallowed; on 429 the call retries once
    /// after the server-suggested delay.
    /// </summary>
    Task SendDailyReturnPushAsync(
        User user,
        string moduleName,
        string moduleId,
        int lessonId,
        string variant,
        CancellationToken ct);
}