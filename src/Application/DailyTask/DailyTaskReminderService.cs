using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.DailyTask;

/// <summary>
/// The daily message about «Задание дня»: what today's task is (the same words Bombora says on its
/// first screen) and one button straight into it, tagged <c>src=push_daily_task</c>.
///
/// Who: the people listed in <see cref="DailyTaskAudience"/> (the owner for now; on the stand too), active, notifications on,
/// the task has material and is not done today.
/// When: once a UTC day, from the hour the person last studied (their habit), kept within
/// 10:00–21:00 Tbilisi; without a habit yet — at 19:00 Tbilisi. A tick missed by the worker is made up
/// later the same day, never after 22:00 Tbilisi.
/// Once a day: the <c>daily_task</c> trigger is claimed before sending; it can be claimed again only
/// on the next UTC day. Whoever gets this message is left out of <c>DailyReturnNotificationService</c>.
/// </summary>
public class DailyTaskReminderService(
    ITraleDbContext db,
    DailyTaskService daily,
    DailyTaskAudience audience,
    IUserNotificationService notifications,
    ILoggerFactory loggerFactory) : IDailyTaskReminderService
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<DailyTaskReminderService>();

    public const string Source = "daily_task";

    // Tbilisi is UTC+4 all year.
    private const int EarliestHourUtc = 6;   // 10:00 Tbilisi
    private const int LatestHourUtc = 17;    // 21:00 Tbilisi
    private const int DefaultHourUtc = 15;   // 19:00 Tbilisi
    private const int LastChanceHourUtc = 18; // after 22:00 Tbilisi — silence until tomorrow

    public Task DispatchAsync(CancellationToken ct) => DispatchAsync(DateTime.UtcNow, ct);

    public async Task DispatchAsync(DateTime nowUtc, CancellationToken ct)
    {
        if (nowUtc.Hour >= LastChanceHourUtc)
        {
            return;
        }

        // Only the listed people, even where the task is open to everyone (the local stand): the stand's
        // database holds other people's Telegram ids, and they must not hear from the test bot.
        var ids = audience.TelegramIds.ToList();
        var users = await db.Users
            .Where(u => u.IsActive && u.NotificationsEnabled && ids.Contains(u.TelegramId))
            .ToListAsync(ct);

        foreach (var user in users)
        {
            var lastPlayed = await db.MiniAppUserProgresses
                .Where(p => p.UserId == user.Id)
                .Select(p => p.LastPlayedAtUtc)
                .FirstOrDefaultAsync(ct);
            if (nowUtc.Hour < SendHourUtc(lastPlayed))
            {
                continue;
            }

            await RemindAsync(user, nowUtc, force: false, ct);
        }

        // The sender flags people who have blocked the bot as inactive — keep that.
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Sends today's reminder to one person now. <paramref name="force"/> (the stand's «сообщение бота»)
    /// skips the once-a-day claim. False when there is nothing to remind about: no task, or it is done.
    /// </summary>
    public async Task<bool> RemindAsync(User user, DateTime nowUtc, bool force, CancellationToken ct)
    {
        var task = await daily.GetAsync(user, nowUtc, dev: false, ct);
        if (!task.Available || task.Done)
        {
            return false;
        }

        if (!force)
        {
            var claimed = await db.TryClaimNotificationTriggerAsync(
                user.TelegramId, Source, task.Mode, nowUtc, nowUtc.Date.AddTicks(-1), ct);
            if (!claimed)
            {
                return false;
            }
        }

        _logger.LogInformation("Daily task reminder to {TelegramId}: {Mode}", user.TelegramId, task.Mode);
        await notifications.SendDailyTaskReminderAsync(user, string.Join("\n\n", task.Chat), task.Button, ct);
        return true;
    }

    /// <summary>The hour (UTC) the person last studied, within the day window; 19:00 Tbilisi when unknown.</summary>
    public static int SendHourUtc(DateTime? lastPlayedUtc) =>
        lastPlayedUtc is { } at ? Math.Clamp(at.Hour, EarliestHourUtc, LatestHourUtc) : DefaultHourUtc;
}

public interface IDailyTaskReminderService
{
    Task DispatchAsync(CancellationToken ct);
}
