using Application.Common;
using Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Notifications;

/// <summary>
/// Streak-milestone push (epic #894, §82): congratulates the user the day they reach
/// 7, 30 or 100-day streaks with a Georgian numeral and a methodist note. Eligibility
/// is exact (not "≥7") — we celebrate the milestone day itself. Each milestone uses
/// its own <c>streak_{n}</c> trigger source so the unique <c>(UserId, Source)</c>
/// index doubles as the dedup key: the same milestone can't fire twice, but a future
/// milestone (e.g. 30 weeks after 7) still passes.
/// </summary>
public class StreakNotificationService(
    ITraleDbContext db,
    IUserNotificationService notificationService,
    ILoggerFactory loggerFactory) : IStreakNotificationService
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<StreakNotificationService>();

    private static readonly int[] Milestones = [7, 30, 100];
    private static readonly TimeSpan CooldownPeriod = TimeSpan.FromDays(1);

    public async Task DispatchAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var cutoff = now - CooldownPeriod;

        var candidates = await db.MiniAppUserProgresses
            .Where(p => Milestones.Contains(p.Streak))
            .Select(p => new { p.UserId, p.Streak })
            .ToListAsync(ct);

        if (candidates.Count == 0) return;

        var userIds = candidates.Select(c => c.UserId).ToList();
        var users = await db.Users
            .Where(u => userIds.Contains(u.Id) && u.IsActive && u.NotificationsEnabled)
            .ToListAsync(ct);

        if (users.Count == 0) return;

        var userMap = users.ToDictionary(u => u.Id);

        foreach (var candidate in candidates)
        {
            if (!userMap.TryGetValue(candidate.UserId, out var user))
                continue;

            var milestone = candidate.Streak;
            var source = $"streak_{milestone}";

            var claimed = await db.TryClaimNotificationTriggerAsync(
                user.TelegramId, source, variant: null, now, cutoff, ct);
            if (!claimed)
            {
                _logger.LogInformation(
                    "User {TelegramId} skipped — {Source} already claimed (24h dedup or concurrent run)",
                    user.TelegramId, source);
                continue;
            }

            await notificationService.SendStreakMilestonePushAsync(user, milestone, ct);
        }
    }
}
