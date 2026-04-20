using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Admin;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Services;

/// <summary>
/// Sends a one-time launch announcement to all existing Georgian-language users
/// who have not yet received it. Idempotent: marks each user before sending so
/// restarts do not produce duplicate messages.
/// </summary>
public class SendLaunchAnnouncementService(
    ITraleDbContext db,
    ITelegramMessageSender telegramSender,
    ILoggerFactory loggerFactory)
{
    private const string AnnouncementText =
        "🐶 Привет! Бомбора теперь открыта для всех.\n\n" +
        "Я — твой щенок-гид по грузинскому языку.\n" +
        "Учу алфавит, числа, фразы выживания и не только.\n\n" +
        "Попробуй прямо сейчас:";

    // Telegram global rate limit is ~30 msg/sec per bot; 50 ms ≈ 20/sec — safe margin.
    private static readonly TimeSpan SendDelay = TimeSpan.FromMilliseconds(50);

    private readonly ILogger _logger = loggerFactory.CreateLogger<SendLaunchAnnouncementService>();

    public async Task<AnnouncementResult> ExecuteAsync(CancellationToken ct)
    {
        List<User> users = await db.Users
            .Include(u => u.Settings)
            .Where(u => u.IsActive
                && u.Settings.CurrentLanguage == Language.Georgian
                && u.MiniAppAnnounceSentAtUtc == null)
            .ToListAsync(ct);

        _logger.LogInformation("LaunchAnnouncement: {Count} eligible users found", users.Count);

        int sent = 0, failed = 0;
        var now = DateTime.UtcNow;

        foreach (var user in users)
        {
            if (ct.IsCancellationRequested) break;

            // Mark BEFORE sending — prevents duplicate on restart if process dies mid-loop.
            user.MiniAppAnnounceSentAtUtc = now;
            await db.SaveChangesAsync(ct);

            var ok = await telegramSender.SendTextAsync(
                user.TelegramId, AnnouncementText, includeMiniAppButton: true, ct);

            if (ok) sent++;
            else
            {
                failed++;
                _logger.LogWarning("Announcement failed for TelegramId={TelegramId}", user.TelegramId);
            }

            await Task.Delay(SendDelay, ct);
        }

        _logger.LogInformation(
            "LaunchAnnouncement complete: sent={Sent} failed={Failed} total={Total}",
            sent, failed, users.Count);

        return new AnnouncementResult(users.Count, sent, failed);
    }
}

public record AnnouncementResult(int Total, int Sent, int Failed);
