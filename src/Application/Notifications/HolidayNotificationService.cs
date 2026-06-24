using Application.Common;
using Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Notifications;

/// <summary>
/// Holiday push dispatcher (epic #894, §82, #993). On the morning of a Georgian holiday
/// it sends one celebratory push per opted-in active user. <c>HourlyNotificationWorker</c>
/// ticks it every hour; the Tbilisi-morning guard happens upstream (see
/// <see cref="TbilisiMorningWindow"/>), so by the time this runs we only need to decide
/// "is today a holiday?" and "have we already sent it today?". The 24h cooldown via the
/// <c>holiday</c> trigger source + atomic claim (see
/// <see cref="DailyReturnNotificationService"/>) keeps concurrent dispatchers from
/// double-sending.
/// </summary>
public class HolidayNotificationService(
    ITraleDbContext db,
    IUserNotificationService notificationService,
    IHolidayCalendarService calendar,
    ILoggerFactory loggerFactory) : IHolidayNotificationService
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<HolidayNotificationService>();
    private const string Source = "holiday";

    // Tbilisi is fixed UTC+4 (no DST). One window per calendar day, so a 24h cooldown
    // collapses repeat dispatches on the same Tbilisi date — even ones that straddle UTC midnight.
    private static readonly TimeSpan CooldownPeriod = TimeSpan.FromHours(24);

    public async Task DispatchAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var tbilisiDate = DateOnly.FromDateTime(now.AddHours(TbilisiMorningWindow.TbilisiOffsetHours));

        var holiday = calendar.GetHolidayFor(tbilisiDate);
        if (holiday is null)
        {
            // AC6: обычный день → 0 запросов к БД пользователей, 0 запросов к Telegram.
            return;
        }

        var users = await db.Users
            .Where(u => u.IsActive && u.NotificationsEnabled)
            .ToListAsync(ct);

        if (users.Count == 0) return;

        var cooldownCutoff = now - CooldownPeriod;

        foreach (var user in users)
        {
            // Atomic claim-before-send: identical pattern to the other dispatchers
            // (DailyReturn/Coins/Streak), so overlapping runs collapse to a single send.
            var claimed = await db.TryClaimNotificationTriggerAsync(
                user.TelegramId, Source, variant: holiday.Key, now, cooldownCutoff, ct);
            if (!claimed)
            {
                _logger.LogInformation(
                    "User {TelegramId} skipped — holiday already claimed (24h cooldown or concurrent run)",
                    user.TelegramId);
                continue;
            }

            await notificationService.SendHolidayPushAsync(user, holiday, ct);
        }
    }
}
