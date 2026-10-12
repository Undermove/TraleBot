using Application.Common;
using Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Notifications;

/// <summary>
/// Reminds a newcomer who pressed «Старт» and never opened the mini-app: once, about a day after
/// registration, with the same button as the first message.
///
/// Who gets it: registered 24–72 hours ago, no <c>MiniAppUserProgress</c> row (it is created on the
/// first open of the mini-app), has not blocked the bot and has not switched notifications off.
/// Sent around the hour of the day the person was in Telegram yesterday, so no night-time guard.
///
/// Never to the existing base: the first run after the release stores the moment the reminder was
/// switched on (a <c>NotificationTrigger</c> row with <see cref="SwitchedOnUserId"/> and
/// <see cref="SwitchedOnSource"/>), and only people registered after that moment are considered.
///
/// Once: the per-user <c>first_open_reminder</c> trigger is claimed before sending and never
/// expires, so neither a second run nor a second instance can send it again.
/// </summary>
public class FirstOpenReminderService(
    ITraleDbContext db,
    IUserNotificationService notificationService,
    ILoggerFactory loggerFactory) : IFirstOpenReminderService
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<FirstOpenReminderService>();

    public const string Source = "first_open_reminder";

    /// <summary>Marker row: <c>LastSentAt</c> is when the reminder was switched on. Not a real user.</summary>
    public const string SwitchedOnSource = "first_open_reminder_switched_on";
    public const long SwitchedOnUserId = 0;

    public static readonly TimeSpan RemindAfter = TimeSpan.FromHours(24);

    /// <summary>Older than this — the moment has passed (e.g. the worker was down); stay silent.</summary>
    public static readonly TimeSpan GiveUpAfter = TimeSpan.FromHours(72);

    /// <summary>A cutoff no trigger is older than: a claimed trigger is never refreshed — one reminder, ever.</summary>
    private static readonly DateTime Never = DateTime.UnixEpoch;

    public Task DispatchAsync(CancellationToken ct) => DispatchAsync(DateTime.UtcNow, ct);

    public async Task DispatchAsync(DateTime nowUtc, CancellationToken ct)
    {
        var switchedOnAt = await SwitchedOnAtAsync(nowUtc, ct);
        var registeredBefore = nowUtc - RemindAfter;
        var registeredAfter = nowUtc - GiveUpAfter;
        if (switchedOnAt > registeredBefore) return; // nobody registered after the switch-on is a day old yet

        var candidates = await db.Users
            .Where(u => u.IsActive && u.NotificationsEnabled
                        && u.RegisteredAtUtc >= switchedOnAt
                        && u.RegisteredAtUtc <= registeredBefore
                        && u.RegisteredAtUtc > registeredAfter
                        && !db.MiniAppUserProgresses.Any(p => p.UserId == u.Id)
                        && !db.NotificationTriggers.Any(t => t.UserId == u.TelegramId && t.Source == Source))
            .ToListAsync(ct);

        foreach (var user in candidates)
        {
            var claimed = await db.TryClaimNotificationTriggerAsync(user.TelegramId, Source, null, nowUtc, Never, ct);
            if (!claimed)
            {
                _logger.LogInformation(
                    "User {TelegramId} skipped — first-open reminder already claimed", user.TelegramId);
                continue;
            }

            await notificationService.SendFirstOpenReminderAsync(user, ct);
        }

        // The sender flags people who have blocked the bot as inactive — keep that.
        await db.SaveChangesAsync(ct);
    }

    private async Task<DateTime> SwitchedOnAtAsync(DateTime nowUtc, CancellationToken ct)
    {
        await db.TryClaimNotificationTriggerAsync(SwitchedOnUserId, SwitchedOnSource, null, nowUtc, Never, ct);
        return await db.NotificationTriggers
            .Where(t => t.UserId == SwitchedOnUserId && t.Source == SwitchedOnSource)
            .Select(t => t.LastSentAt)
            .SingleAsync(ct);
    }
}
