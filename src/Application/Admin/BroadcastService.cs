using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.MiniApp;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Admin;

/// <summary>
/// Owner-only: send a message + optionally grant Pro to a segment of users.
/// Segment can be filtered by activity recency, by minimum vocabulary size,
/// or both. The vocabulary filter is the "wake up dormant users" knob —
/// people who once collected lots of words but stopped using the bot.
/// </summary>
public class BroadcastService(
    ITraleDbContext db,
    ITelegramMessageSender telegramSender,
    ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<BroadcastService>();

    public async Task<BroadcastPreview> PreviewAsync(BroadcastSegment segment, CancellationToken ct)
    {
        var ids = await ResolveTelegramIdsAsync(segment, ct);
        return new BroadcastPreview
        {
            TotalRecipients = ids.Count,
            SampleTelegramIds = ids.Take(10).ToList()
        };
    }

    public async Task<BroadcastResult> ExecuteAsync(
        BroadcastSegment segment,
        string message,
        string? grantPlanName,
        bool dryRun,
        bool includeMiniAppButton,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return new BroadcastResult { Error = "Empty message" };
        }
        if (message.Length > 4000)
        {
            return new BroadcastResult { Error = "Message too long (max 4000 chars)" };
        }

        var telegramIds = await ResolveTelegramIdsAsync(segment, ct);

        SubscriptionPlan? plan = null;
        if (!string.IsNullOrEmpty(grantPlanName))
        {
            if (!Enum.TryParse<SubscriptionPlan>(grantPlanName, true, out var parsed))
            {
                return new BroadcastResult { Error = $"Unknown plan: {grantPlanName}" };
            }
            plan = parsed;
        }

        if (dryRun)
        {
            return new BroadcastResult { Sent = 0, Granted = 0, Failed = 0, TotalRecipients = telegramIds.Count };
        }

        var users = await db.Users
            .Where(u => telegramIds.Contains(u.TelegramId))
            .ToListAsync(ct);

        var sent = 0;
        var failed = 0;
        var granted = 0;
        var now = DateTime.UtcNow;

        foreach (var user in users)
        {
            if (plan.HasValue && !user.IsPro)
            {
                user.IsPro = true;
                user.SubscriptionPlan = plan.Value;
                user.ProPurchasedAtUtc ??= now;
                if (plan.Value == SubscriptionPlan.Lifetime)
                {
                    user.SubscribedUntil = null;
                }
                else
                {
                    var planInfo = SubscriptionPlans.ByPlan(plan.Value);
                    if (planInfo?.DurationDays != null)
                    {
                        user.SubscribedUntil = now.AddDays(planInfo.DurationDays.Value);
                    }
                }
                granted++;
            }

            var ok = await telegramSender.SendTextAsync(
                user.TelegramId, message, includeMiniAppButton, ct);
            if (ok) sent++;
            else
            {
                failed++;
                _logger.LogWarning("Broadcast failed for {TelegramId}", user.TelegramId);
            }
        }

        if (granted > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        _logger.LogInformation("Broadcast done: sent={Sent} failed={Failed} granted={Granted} of {Total}",
            sent, failed, granted, telegramIds.Count);

        return new BroadcastResult
        {
            TotalRecipients = telegramIds.Count,
            Sent = sent,
            Failed = failed,
            Granted = granted
        };
    }

    private async Task<List<long>> ResolveTelegramIdsAsync(BroadcastSegment segment, CancellationToken ct)
    {
        // Start with all active users, then layer filters.
        var users = db.Users.Where(u => u.IsActive);

        // Filter by minimum vocabulary count
        if (segment.MinVocabularyCount > 0)
        {
            var minVocab = segment.MinVocabularyCount;
            users = users.Where(u =>
                db.VocabularyEntries.Count(v => v.UserId == u.Id) >= minVocab);
        }

        // Filter by activity recency (only when explicitly requested)
        if (segment.ActiveWithinDays.HasValue && segment.ActiveWithinDays.Value > 0)
        {
            var since = DateTime.UtcNow.AddDays(-segment.ActiveWithinDays.Value);
            var fromVocab = db.VocabularyEntries
                .Where(v => v.DateAddedUtc >= since)
                .Select(v => v.UserId);
            var fromQuiz = db.Quizzes
                .Where(q => q.DateStarted >= since)
                .Select(q => q.UserId);
            var fromMiniApp = db.MiniAppUserProgresses
                .Where(p => p.LastPlayedAtUtc != null && p.LastPlayedAtUtc >= since)
                .Select(p => p.UserId);

            var activeUserIds = await fromVocab.Union(fromQuiz).Union(fromMiniApp).Distinct().ToListAsync(ct);
            users = users.Where(u => activeUserIds.Contains(u.Id));
        }

        return await users.Select(u => u.TelegramId).ToListAsync(ct);
    }
}

public class BroadcastSegment
{
    /// <summary>Minimum vocabulary entries required (0 = no filter).</summary>
    public int MinVocabularyCount { get; set; }

    /// <summary>Optional recency filter — null/0 means no recency filter (waking dormant users).</summary>
    public int? ActiveWithinDays { get; set; }
}

public interface ITelegramMessageSender
{
    Task<bool> SendTextAsync(long telegramId, string text, bool includeMiniAppButton, CancellationToken ct);
}

public class BroadcastPreview
{
    public int TotalRecipients { get; init; }
    public List<long> SampleTelegramIds { get; init; } = new();
}

public class BroadcastResult
{
    public int TotalRecipients { get; init; }
    public int Sent { get; init; }
    public int Failed { get; init; }
    public int Granted { get; init; }
    public string? Error { get; init; }
}
