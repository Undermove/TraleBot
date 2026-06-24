using Application.Common;
using Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Notifications;

/// <summary>
/// Contextual coins-stale push (epic #894, §82, #994): nudges users who have at
/// least <see cref="MinAvailableXp"/> spendable XP but haven't fed Bombora in the
/// past 7 days. Per-user 7-day cooldown via <c>coins</c> trigger source; the
/// claim-before-send pattern (see <see cref="DailyReturnNotificationService"/>)
/// keeps concurrent dispatchers from double-sending. <c>HourlyNotificationWorker</c>
/// ticks it every top-of-hour UTC.
/// </summary>
public class CoinsNotificationService(
    ITraleDbContext db,
    IUserNotificationService notificationService,
    ILoggerFactory loggerFactory) : ICoinsNotificationService
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<CoinsNotificationService>();
    private const string Source = "coins";

    /// <summary>V1 threshold from the epic: enough XP to buy at least the mid-tier treat (Khorci, 30 XP)
    /// with room to spare, so the nudge feels meaningful.</summary>
    private const int MinAvailableXp = 50;

    private static readonly TimeSpan StaleFeedingThreshold = TimeSpan.FromDays(7);
    private static readonly TimeSpan CooldownPeriod = TimeSpan.FromDays(7);

    public async Task DispatchAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var feedingCutoff = now - StaleFeedingThreshold;

        // LastFedAtUtc null → never fed Bombora (also "stale" by definition).
        // Computing balance in SQL keeps the candidate list small even on a real
        // user base — most accounts won't clear the 50-XP bar.
        var progressList = await db.MiniAppUserProgresses
            .Where(p => p.Xp - p.XpSpent >= MinAvailableXp
                     && (p.LastFedAtUtc == null || p.LastFedAtUtc < feedingCutoff))
            .Select(p => new { p.UserId, AvailableXp = p.Xp - p.XpSpent })
            .ToListAsync(ct);

        if (progressList.Count == 0) return;

        var userIds = progressList.Select(p => p.UserId).ToList();
        var users = await db.Users
            .Where(u => userIds.Contains(u.Id) && u.IsActive && u.NotificationsEnabled)
            .ToListAsync(ct);

        if (users.Count == 0) return;

        var userMap = users.ToDictionary(u => u.Id);
        var cooldownCutoff = now - CooldownPeriod;

        foreach (var candidate in progressList)
        {
            if (!userMap.TryGetValue(candidate.UserId, out var user))
                continue;

            // Atomic cooldown check + trigger write — same pattern as DailyReturnNotificationService:
            // if a concurrent run already claimed within 7 days, skip silently.
            var claimed = await db.TryClaimNotificationTriggerAsync(
                user.TelegramId, Source, variant: null, now, cooldownCutoff, ct);
            if (!claimed)
            {
                _logger.LogInformation(
                    "User {TelegramId} skipped — coins-stale already claimed (cooldown or concurrent run)",
                    user.TelegramId);
                continue;
            }

            await notificationService.SendCoinsStalePushAsync(user, candidate.AvailableXp, ct);
        }
    }
}
