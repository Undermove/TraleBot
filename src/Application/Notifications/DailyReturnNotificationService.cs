using System.Text.Json;
using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Notifications;

/// <summary>
/// Targets the D1+ return push (epic #940). Eligible = started at least one lesson,
/// hasn't played in &gt;30h, is active and opted in — capped to once per 7 days via
/// <see cref="NotificationTrigger"/>. Picks the least-progressed module, deep-links to
/// its next lesson, and chooses the copy variant by spendable XP (enough → "feed",
/// otherwise → "earn"). Resolved as <see cref="IDailyReturnNotificationService"/>;
/// <c>ReturnPushWorker</c> calls <see cref="DispatchAsync"/> once a day.
/// </summary>
public class DailyReturnNotificationService(
    ITraleDbContext db,
    IUserNotificationService notificationService,
    ILoggerFactory loggerFactory) : IDailyReturnNotificationService
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<DailyReturnNotificationService>();
    private const string Source = "daily_return";
    private const int CheapestTreatXp = 10; // mirrors FeedTreatService.TreatPrices[0]
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
        var cooldownCutoff = now - CooldownPeriod;

        foreach (var progress in progressList)
        {
            if (!userMap.TryGetValue(progress.UserId, out var user))
                continue;

            var completedLessons = ParseCompletedLessons(progress.CompletedLessonsJson);
            var validModules = completedLessons
                .Where(kv => kv.Value.Count > 0)
                .OrderBy(kv => kv.Value.Count)
                .ToList();

            if (validModules.Count == 0) continue;

            var (moduleId, lessonIds) = validModules[0];
            var nextLessonId = lessonIds.Max() + 1;

            // Variant by mechanic: enough spendable XP → "feed" (you can feed Bombora),
            // otherwise "earn" (do a lesson to earn XP). moduleName is only rendered for the
            // "module" variant, which we don't use here, so moduleId stands in safely.
            var availableXp = Math.Max(0, progress.Xp - progress.XpSpent);
            var variant = availableXp >= CheapestTreatXp ? "feed" : "earn";

            // Claim the slot BEFORE sending: the cooldown check and the trigger write are now a
            // single atomic step, so two overlapping dispatch runs can't both pass the check and
            // both send (the 2026-06-17 double-send). Losing the claim means another run already
            // sent it, or the 7-day cooldown is still active — either way, skip.
            var claimed = await db.TryClaimNotificationTriggerAsync(
                user.TelegramId, Source, variant, DateTime.UtcNow, cooldownCutoff, ct);
            if (!claimed)
            {
                _logger.LogInformation(
                    "User {TelegramId} skipped — daily-return already claimed (cooldown or concurrent run)",
                    user.TelegramId);
                continue;
            }

            await notificationService.SendDailyReturnPushAsync(
                user, moduleId, moduleId, nextLessonId, variant, availableXp, ct);
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
