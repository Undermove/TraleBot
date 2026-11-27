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
/// Who: active, notifications on, the task has material and is not done today, and either listed in
/// <see cref="DailyTaskAudience"/> (the owner) or — on prod — studied in the mini-app within <see cref="RecentlyStudied"/>.
/// Someone who stopped longer ago is left to the weekly return push.
/// At most one reminder a day: not when the bot already reminded the person of something else today.
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

    /// <summary>Who studied this recently is reminded every day; three reminders after the last lesson, then quiet.</summary>
    public static readonly TimeSpan RecentlyStudied = TimeSpan.FromDays(3);

    public Task DispatchAsync(CancellationToken ct) => DispatchAsync(DateTime.UtcNow, ct);

    public async Task DispatchAsync(DateTime nowUtc, CancellationToken ct)
    {
        if (nowUtc.Hour >= LastChanceHourUtc)
        {
            return;
        }

        // The listed people always; everyone else who studied lately only on prod — the stand's database
        // holds other people's Telegram ids, and they must not hear from the test bot.
        var ids = audience.TelegramIds.ToList();
        var everyone = audience.PushEveryone;
        var studiedAfter = nowUtc - RecentlyStudied;
        var users = await db.Users
            .Where(u => u.IsActive && u.NotificationsEnabled
                        && (ids.Contains(u.TelegramId)
                            || (everyone && db.MiniAppUserProgresses.Any(p => p.UserId == u.Id && p.LastPlayedAtUtc >= studiedAfter))))
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

            // One reminder a day: the return push, a first-week nudge and the like already spoke today.
            if (await RemindedTodayAsync(db, user.TelegramId, nowUtc, except: Source, ct))
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

        // A task composed before the push existed is reminded about with its last line.
        var push = task.Push ?? new DailyPush("mix", "✨ Задание дня готово", task.Chat.LastOrDefault() ?? "", task.Button);
        if (!force)
        {
            var claimed = await db.TryClaimNotificationTriggerAsync(
                user.TelegramId, Source, push.Variant, nowUtc, nowUtc.Date.AddTicks(-1), ct);
            if (!claimed)
            {
                return false;
            }
        }

        _logger.LogInformation("Daily task reminder to {TelegramId}: {Variant}", user.TelegramId, push.Variant);
        await notifications.SendDailyTaskReminderAsync(user, push, ct);
        return true;
    }

    /// <summary>Whether the bot already sent this person a reminder (other than <paramref name="except"/>) this UTC day.</summary>
    public static Task<bool> RemindedTodayAsync(ITraleDbContext db, long telegramId, DateTime nowUtc, string? except, CancellationToken ct)
    {
        var dayStart = nowUtc.Date;
        return db.NotificationTriggers.AnyAsync(
            t => t.UserId == telegramId && t.Source != except && t.LastSentAt >= dayStart, ct);
    }

    /// <summary>Whether this person got today's «Задание дня» reminder — other pushes stay quiet then.</summary>
    public static Task<bool> GotTodaysTaskAsync(ITraleDbContext db, long telegramId, DateTime nowUtc, CancellationToken ct)
    {
        var dayStart = nowUtc.Date;
        return db.NotificationTriggers.AnyAsync(
            t => t.UserId == telegramId && t.Source == Source && t.LastSentAt >= dayStart, ct);
    }

    /// <summary>The hour (UTC) the person last studied, within the day window; 19:00 Tbilisi when unknown.</summary>
    public static int SendHourUtc(DateTime? lastPlayedUtc) =>
        lastPlayedUtc is { } at ? Math.Clamp(at.Hour, EarliestHourUtc, LatestHourUtc) : DefaultHourUtc;
}

public interface IDailyTaskReminderService
{
    Task DispatchAsync(CancellationToken ct);
}
