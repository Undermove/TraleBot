using System.Text.Json;
using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Notifications;

public class DailyReturnNotificationService(
    ITraleDbContext db,
    IUserNotificationService notificationService,
    ILoggerFactory loggerFactory) : IDailyReturnDispatch
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<DailyReturnNotificationService>();
    private const string Source = "daily_return";
    // Eligibility: user hasn't played in >1 day + 6h = 30h
    private static readonly TimeSpan EligibilityThreshold = TimeSpan.FromDays(1) + TimeSpan.FromHours(6);
    private static readonly TimeSpan CooldownPeriod = TimeSpan.FromDays(7);

    public async Task DispatchAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var cutoff = now - EligibilityThreshold;

        var progressList = await db.MiniAppUserProgresses
            .Where(p => p.LastPlayedAtUtc != null
                     && p.LastPlayedAtUtc < cutoff
                     && p.CompletedLessonsJson != "{}"
                     && p.CompletedLessonsJson != "null")
            .ToListAsync(ct);

        if (progressList.Count == 0) return;

        var userIds = progressList.Select(p => p.UserId).ToList();
        var users = await db.Users
            .Where(u => userIds.Contains(u.Id) && u.IsActive && u.NotificationsEnabled)
            .ToListAsync(ct);

        if (users.Count == 0) return;

        var userMap = users.ToDictionary(u => u.Id);
        var telegramIds = users.Select(u => u.TelegramId).ToList();

        var triggers = await db.NotificationTriggers
            .Where(t => telegramIds.Contains(t.UserId) && t.Source == Source)
            .ToListAsync(ct);
        var triggerMap = triggers.ToDictionary(t => t.UserId);

        foreach (var progress in progressList)
        {
            if (!userMap.TryGetValue(progress.UserId, out var user))
                continue;

            triggerMap.TryGetValue(user.TelegramId, out var trigger);

            // Skip if notified within the 7-day cooldown window
            if (trigger != null && trigger.LastSentAt > now - CooldownPeriod)
            {
                _logger.LogInformation(
                    "User {TelegramId} skipped due to cooldown (lastSentAt={LastSentAt})",
                    user.TelegramId, trigger.LastSentAt);
                continue;
            }

            var completedLessons = ParseCompletedLessons(progress.CompletedLessonsJson);
            if (completedLessons.Count == 0) continue;

            // Pick the module with the least progress (fewest completed lessons)
            var validModules = completedLessons
                .Where(kv => kv.Value.Count > 0)
                .OrderBy(kv => kv.Value.Count)
                .ToList();

            if (validModules.Count == 0) continue;

            var (moduleId, lessonIds) = validModules[0];
            var nextLessonId = lessonIds.Max() + 1;
            var variant = Random.Shared.NextDouble() < 0.5 ? "A" : "B";

            await notificationService.SendDailyReturnPushAsync(
                user,
                moduleId,
                moduleId,
                nextLessonId,
                variant,
                ct);

            // Upsert trigger
            var sentAt = DateTime.UtcNow;
            if (trigger != null)
            {
                trigger.LastSentAt = sentAt;
                trigger.Variant = variant;
            }
            else
            {
                db.NotificationTriggers.Add(new NotificationTrigger
                {
                    Id = Guid.NewGuid(),
                    UserId = user.TelegramId,
                    Source = Source,
                    LastSentAt = sentAt,
                    Variant = variant
                });
            }
            await db.SaveChangesAsync(ct);
        }
    }

    private static Dictionary<string, List<int>> ParseCompletedLessons(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json)
                   ?? new Dictionary<string, List<int>>();
        }
        catch
        {
            return new Dictionary<string, List<int>>();
        }
    }
}
