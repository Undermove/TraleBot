using System.Text.Json;
using Application.Common;
using Application.Common.Interfaces;
using Application.Common.Interfaces.MiniApp;
using Application.MiniApp;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Notifications;

/// <summary>
/// The first week of a newcomer: on days 1, 3 and 7 after registration — at about the hour they joined —
/// one short message with the next lesson of the module they are taking (its title and what it gives) and a
/// button straight into it. Whoever studied in the last 20 hours is left alone that day.
///
/// Who: opened the mini-app (has a <c>MiniAppUserProgress</c>; those who never opened it get
/// <see cref="FirstOpenReminderService"/>), has not blocked the bot and has not switched notifications off.
/// Only people registered after the first run of this release (marker <see cref="SwitchedOnSource"/>), so
/// the existing base gets nothing. While someone is in their first week, <see cref="DailyReturnNotificationService"/>
/// leaves them to these messages.
///
/// On day 7 whoever studies in earnest — <see cref="EngagedOffer.MinLessons"/> lessons on <see cref="EngagedOffer.MinDays"/>
/// different days, no payment, no running Pro — gets the offer of the old prices (<see cref="EngagedOffer"/>,
/// trigger <see cref="PriceSchedule.OfferSource"/>) instead of the day-7 message, whenever they last studied.
///
/// Once per day and person: the trigger <c>first_week_d1</c> / <c>_d3</c> / <c>_d7</c> is claimed before
/// sending and never expires, so neither a second run nor a second instance sends it again. A day that was
/// missed by more than a day (the worker was down) is skipped.
/// </summary>
public class FirstWeekNudgeService(
    ITraleDbContext db,
    IMiniAppContentProvider content,
    IUserNotificationService notificationService,
    PriceSchedule prices,
    ILoggerFactory loggerFactory) : IFirstWeekNudgeService
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<FirstWeekNudgeService>();

    public static readonly int[] Days = [1, 3, 7];
    public static string SourceFor(int day) => $"first_week_d{day}";

    /// <summary>Marker row: <c>LastSentAt</c> is when the first-week messages were switched on. Not a real user.</summary>
    public const string SwitchedOnSource = "first_week_switched_on";
    public const long SwitchedOnUserId = 0;

    /// <summary>Studied this recently — no need to remind today.</summary>
    public static readonly TimeSpan RecentlyPlayed = TimeSpan.FromHours(20);

    /// <summary>The length of the first week: until then <see cref="DailyReturnNotificationService"/> stays away.</summary>
    public static readonly TimeSpan FirstWeek = TimeSpan.FromDays(8);

    private static readonly DateTime Never = DateTime.UnixEpoch;

    public Task DispatchAsync(CancellationToken ct) => DispatchAsync(DateTime.UtcNow, ct);

    public async Task DispatchAsync(DateTime nowUtc, CancellationToken ct)
    {
        var switchedOnAt = await SwitchedOnAtAsync(db, nowUtc, ct);

        if (switchedOnAt <= nowUtc - TimeSpan.FromDays(7))
            await OfferToEngagedAsync(nowUtc, switchedOnAt, ct);

        foreach (var day in Days)
        {
            var registeredBefore = nowUtc - TimeSpan.FromDays(day);
            var registeredAfter = registeredBefore - TimeSpan.FromDays(1);
            if (switchedOnAt > registeredBefore) continue;
            var source = SourceFor(day);
            var playedBefore = nowUtc - RecentlyPlayed;

            var due = await db.Users
                .Where(u => u.IsActive && u.NotificationsEnabled
                            && u.RegisteredAtUtc >= switchedOnAt
                            && u.RegisteredAtUtc <= registeredBefore
                            && u.RegisteredAtUtc > registeredAfter
                            && !db.NotificationTriggers.Any(t => t.UserId == u.TelegramId && t.Source == source))
                .Join(db.MiniAppUserProgresses, u => u.Id, p => p.UserId, (u, p) => new { User = u, Progress = p })
                .Where(x => x.Progress.LastPlayedAtUtc == null || x.Progress.LastPlayedAtUtc < playedBefore)
                .ToListAsync(ct);

            foreach (var x in due)
            {
                var nudge = Build(day, x.Progress.CompletedLessonsJson);
                if (nudge == null) continue; // every lesson already taken — nothing to point at

                if (!await db.TryClaimNotificationTriggerAsync(x.User.TelegramId, source, null, nowUtc, Never, ct))
                {
                    _logger.LogInformation("User {TelegramId} skipped — {Source} already claimed", x.User.TelegramId, source);
                    continue;
                }

                await notificationService.SendFirstWeekNudgeAsync(x.User, nudge, ct);
            }
        }

        // The sender flags people who have blocked the bot as inactive — keep that.
        await db.SaveChangesAsync(ct);
    }

    private async Task OfferToEngagedAsync(DateTime nowUtc, DateTime switchedOnAt, CancellationToken ct)
    {
        var registeredBefore = nowUtc - TimeSpan.FromDays(7);
        var registeredAfter = registeredBefore - TimeSpan.FromDays(1);
        var day7 = SourceFor(7);

        var due = await db.Users
            .Where(u => u.IsActive && u.NotificationsEnabled
                        && u.RegisteredAtUtc >= switchedOnAt
                        && u.RegisteredAtUtc <= registeredBefore
                        && u.RegisteredAtUtc > registeredAfter
                        && !db.Payments.Any(p => p.UserId == u.Id)
                        && !db.NotificationTriggers.Any(t => t.UserId == u.TelegramId && (t.Source == day7 || t.Source == PriceSchedule.OfferSource)))
            .ToListAsync(ct);

        foreach (var user in due.Where(u => !u.HasActivePro(nowUtc)))
        {
            var done = await db.LessonEvents
                .Where(e => e.UserId == user.Id && e.Event == "lesson_complete" && e.ModuleId != "onboarding" && e.CreatedAtUtc >= user.RegisteredAtUtc)
                .Select(e => e.CreatedAtUtc)
                .ToListAsync(ct);
            if (done.Count < EngagedOffer.MinLessons || done.Select(at => at.Date).Distinct().Count() < EngagedOffer.MinDays)
                continue;

            if (!await db.TryClaimNotificationTriggerAsync(user.TelegramId, PriceSchedule.OfferSource, null, nowUtc, Never, ct))
                continue;
            // The offer stands in for the day-7 message.
            await db.TryClaimNotificationTriggerAsync(user.TelegramId, day7, "offer", nowUtc, Never, ct);

            await notificationService.SendEngagedOfferAsync(user, EngagedOffer.Text(done.Count, nowUtc, prices), ct);
        }
    }

    /// <summary>The day's message: the next lesson of the module the person has gone furthest in
    /// (the alphabet for someone who has not finished a lesson yet). Null — nothing left to take.</summary>
    public FirstWeekNudge? Build(int day, string completedLessonsJson)
    {
        var completed = ParseCompletedLessons(completedLessonsJson);
        var started = completed
            .Select(kv => (Module: kv.Key, Done: kv.Value.ToHashSet(), Order: content.LessonOrder(kv.Key)))
            .Where(m => m.Order.Count > 0 && m.Done.Count > 0)
            .OrderByDescending(m => m.Done.Count)
            .ToList();
        var (module, done, order) = started.Count > 0
            ? started[0]
            : (LearningConstants.Modules.Alphabet, new HashSet<int>(), content.LessonOrder(LearningConstants.Modules.Alphabet));

        var next = order.FirstOrDefault(l => !done.Contains(l.Id));
        if (next == null) return null;

        var lessonsDone = completed.Values.Sum(v => v.Count);
        return new FirstWeekNudge(day, Text(day, lessonsDone, content.ModuleTitle(module) ?? "", next), module, next.Id);
    }

    internal static string Text(int day, int lessonsDone, string moduleTitle, LessonOutline next)
    {
        var lesson = $"«{next.Title}» — {moduleTitle}\n{next.Goal}";
        return (day, lessonsDone > 0) switch
        {
            (1, false) => $"Бомбора ждёт тебя на первом уроке 🐶\n\n{lesson}\n\nОткрой урок — это 2–3 минуты.",
            (1, true) => $"Хорошее начало 👏 Следующий урок:\n\n{lesson}\n\nОткрой его — это 2–3 минуты.",
            (3, false) => $"Первый урок всё ещё ждёт 🐶\n\n{lesson}\n\nОткрой его сейчас — 2–3 минуты, и первые слова по-грузински твои.",
            (3, true) => $"Уроков пройдено: {lessonsDone} 💪 Следующий:\n\n{lesson}\n\nОткрой его — пара минут в день, и буквы начинают читаться сами.",
            (_, false) => $"Прошла неделя, а первый урок всё ещё ждёт 🐶\n\n{lesson}\n\nОткрой его — всего 2–3 минуты.",
            _ => $"Неделя с грузинским 🇬🇪 Уроков пройдено: {lessonsDone}. Следующий:\n\n{lesson}\n\nОткрой его и держи темп — 2–3 минуты в день.",
        };
    }

    /// <summary>When the messages were switched on — the first run stores now. Shared with the daily return push.</summary>
    internal static async Task<DateTime> SwitchedOnAtAsync(ITraleDbContext db, DateTime nowUtc, CancellationToken ct)
    {
        await db.TryClaimNotificationTriggerAsync(SwitchedOnUserId, SwitchedOnSource, null, nowUtc, Never, ct);
        return await db.NotificationTriggers
            .Where(t => t.UserId == SwitchedOnUserId && t.Source == SwitchedOnSource)
            .Select(t => t.LastSentAt)
            .SingleAsync(ct);
    }

    private static Dictionary<string, List<int>> ParseCompletedLessons(string? json)
    {
        try { return JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json ?? "") ?? []; }
        catch { return []; }
    }
}

/// <summary>One first-week message: the text and the lesson its button opens.</summary>
public record FirstWeekNudge(int Day, string Text, string ModuleId, int LessonId);
