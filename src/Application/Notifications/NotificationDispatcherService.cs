using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Notifications;

/// <summary>
/// Evaluates three notification triggers (Holiday, Coins, Streak) for every user
/// who has notifications enabled and sends at most one Telegram message per user per run.
/// Date comparisons use UTC+4 (Tbilisi timezone).
/// </summary>
public class NotificationDispatcherService(
    ITraleDbContext db,
    HolidayCalendarService holidayCalendar,
    ITelegramMessageSender sender,
    TimeProvider timeProvider)
{
    private static readonly TimeZoneInfo TbilisiTz =
        TimeZoneInfo.FindSystemTimeZoneById("Asia/Tbilisi");

    public async Task ExecuteAsync(CancellationToken ct)
    {
        var utcNow = timeProvider.GetUtcNow().UtcDateTime;
        var todayTbilisi = ToTbilisiDate(utcNow);
        var holiday = holidayCalendar.GetTodayHoliday(todayTbilisi);

        var users = await db.Users
            .Include(u => u.NotificationTriggers)
            .Where(u => u.NotificationsEnabled)
            .ToListAsync(ct);

        var userIds = users.Select(u => u.Id).ToList();
        var progresses = await db.MiniAppUserProgresses
            .Where(p => userIds.Contains(p.UserId))
            .ToDictionaryAsync(p => p.UserId, ct);

        foreach (var user in users)
        {
            var progress = progresses.GetValueOrDefault(user.Id);

            bool sent = await TryHoliday(user, holiday, todayTbilisi, utcNow, ct);
            if (!sent && progress != null)
                sent = await TryCoins(user, progress, utcNow, ct);
            if (!sent && progress != null)
                await TryStreak(user, progress, todayTbilisi, utcNow, ct);
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<bool> TryHoliday(
        User user, HolidayInfo? holiday,
        DateOnly todayTbilisi, DateTime utcNow, CancellationToken ct)
    {
        if (holiday == null) return false;

        var trigger = user.NotificationTriggers
            .FirstOrDefault(t => t.Source == NotificationSource.Holiday);

        if (IsSameTbilisiDay(trigger?.LastSentAt, todayTbilisi)) return false;

        var message = $"{holiday.NameRu}\n\n{holiday.GreetingKa}\n{holiday.Transliteration}\n{holiday.TranslationRu}";
        await sender.SendTextAsync(user.TelegramId, message, includeMiniAppButton: true, ct);

        trigger = EnsureTrigger(user, trigger, NotificationSource.Holiday);
        trigger.LastSentAt = utcNow;
        return true;
    }

    private async Task<bool> TryCoins(
        User user, MiniAppUserProgress progress,
        DateTime utcNow, CancellationToken ct)
    {
        var availableXp = progress.Xp - progress.XpSpent;
        if (availableXp < 50) return false;

        if (IsWithin7Days(progress.LastFedAtUtc, utcNow)) return false;

        var trigger = user.NotificationTriggers
            .FirstOrDefault(t => t.Source == NotificationSource.Coins);

        if (IsWithin7Days(trigger?.LastSentAt, utcNow)) return false;

        const string message =
            "ბომბორა გახარდება!\n" +
            "Бомбора гахардеба!\n" +
            "Бомбора обрадуется! 🦁\n\n" +
            "Монеты ждут — угости Бомбору угощением!";

        await sender.SendTextAsync(user.TelegramId, message, includeMiniAppButton: true, ct);

        trigger = EnsureTrigger(user, trigger, NotificationSource.Coins);
        trigger.LastSentAt = utcNow;
        return true;
    }

    private async Task<bool> TryStreak(
        User user, MiniAppUserProgress progress,
        DateOnly todayTbilisi, DateTime utcNow, CancellationToken ct)
    {
        var trigger = user.NotificationTriggers
            .FirstOrDefault(t => t.Source == NotificationSource.Streak);

        var milestone = trigger?.NextStreakMilestone ?? 7;
        if (milestone <= 0 || progress.Streak != milestone) return false;

        if (IsSameTbilisiDay(trigger?.LastSentAt, todayTbilisi)) return false;

        var message = BuildStreakMessage(milestone);
        await sender.SendTextAsync(user.TelegramId, message, includeMiniAppButton: true, ct);

        trigger = EnsureTrigger(user, trigger, NotificationSource.Streak);
        trigger.LastSentAt = utcNow;
        trigger.NextStreakMilestone = NextMilestone(milestone);
        return true;
    }

    private NotificationTrigger EnsureTrigger(
        User user, NotificationTrigger? existing, NotificationSource source)
    {
        if (existing != null) return existing;
        var trigger = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Source = source
        };
        db.NotificationTriggers.Add(trigger);
        user.NotificationTriggers.Add(trigger);
        return trigger;
    }

    private bool IsSameTbilisiDay(DateTime? utcDateTime, DateOnly todayTbilisi)
    {
        if (!utcDateTime.HasValue) return false;
        var dt = DateTime.SpecifyKind(utcDateTime.Value, DateTimeKind.Utc);
        return ToTbilisiDate(dt) == todayTbilisi;
    }

    private static bool IsWithin7Days(DateTime? utcDateTime, DateTime utcNow)
    {
        if (!utcDateTime.HasValue) return false;
        return (utcNow - utcDateTime.Value).TotalDays <= 7;
    }

    private static DateOnly ToTbilisiDate(DateTime utcDateTime) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc), TbilisiTz));

    private static string BuildStreakMessage(int milestone) => milestone switch
    {
        7 => "🔥 7 дней подряд — отличный старт! შვიდი (7) დღე!",
        30 => "🔥🔥🔥 ოცდაათი (20+10) დღე — 30 дней подряд! Невероятно!",
        100 => "💎 100 дней подряд — легендарный результат!",
        _ => $"🔥 {milestone} дней подряд!"
    };

    private static int NextMilestone(int current) => current switch
    {
        7 => 30,
        30 => 100,
        _ => 0
    };
}
