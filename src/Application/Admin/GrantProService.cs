using System;
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
/// Owner-only: grant Pro access to a user without payment (manual gift / promo / refund replacement).
/// </summary>
public class GrantProService(ITraleDbContext db, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<GrantProService>();

    public async Task<GrantProResult> ExecuteAsync(long telegramId, string planName, CancellationToken ct)
    {
        if (!Enum.TryParse<SubscriptionPlan>(planName, true, out var plan))
        {
            return GrantProResult.InvalidPlan;
        }

        var planInfo = SubscriptionPlans.ByPlan(plan);
        if (planInfo == null)
        {
            return GrantProResult.InvalidPlan;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == telegramId, ct);
        if (user == null)
        {
            return GrantProResult.UserNotFound;
        }

        var now = DateTime.UtcNow;
        user.IsPro = true;
        user.SubscriptionPlan = plan;
        if (!user.ProPurchasedAtUtc.HasValue) user.ProPurchasedAtUtc = now;

        if (plan == SubscriptionPlan.Lifetime)
        {
            user.SubscribedUntil = null;
        }
        else if (planInfo.DurationDays.HasValue)
        {
            var startFrom = user.SubscribedUntil.HasValue && user.SubscribedUntil.Value > now
                ? user.SubscribedUntil.Value
                : now;
            user.SubscribedUntil = startFrom.AddDays(planInfo.DurationDays.Value);
        }

        await db.SaveChangesAsync(ct);

        _logger.LogInformation("Admin granted Pro plan {Plan} to user {TelegramId} (until {Until})",
            plan, telegramId, user.SubscribedUntil?.ToString("u") ?? "lifetime");

        return GrantProResult.Success;
    }
}

public enum GrantProResult
{
    Success,
    UserNotFound,
    InvalidPlan
}

public class RevokeProService(ITraleDbContext db, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<RevokeProService>();

    public async Task<bool> ExecuteAsync(long telegramId, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == telegramId, ct);
        if (user == null) return false;

        user.IsPro = false;
        user.SubscriptionPlan = null;
        user.SubscribedUntil = null;
        await db.SaveChangesAsync(ct);

        _logger.LogInformation("Admin revoked Pro from user {TelegramId}", telegramId);
        return true;
    }
}
