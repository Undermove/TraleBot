using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

public class GetUserDetailQuery(ITraleDbContext db)
{
    public async Task<UserDetailDto?> ExecuteAsync(long telegramId, CancellationToken ct)
    {
        var user = await db.Users
            .Include(u => u.Settings)
            .FirstOrDefaultAsync(u => u.TelegramId == telegramId, ct);

        if (user == null) return null;

        var vocabCount = await db.VocabularyEntries.CountAsync(v => v.UserId == user.Id, ct);

        var payments = await db.Payments
            .Where(p => p.UserId == user.Id)
            .OrderByDescending(p => p.PurchasedAtUtc)
            .Select(p => new PaymentDto
            {
                ChargeId = p.TelegramPaymentChargeId,
                Plan = p.Plan.ToString(),
                Amount = p.Amount,
                Currency = p.Currency,
                PurchasedAtUtc = p.PurchasedAtUtc,
                RefundedAtUtc = p.RefundedAtUtc
            })
            .ToListAsync(ct);

        var progress = await db.MiniAppUserProgresses
            .FirstOrDefaultAsync(p => p.UserId == user.Id, ct);

        // Last activity = max of progress.UpdatedAtUtc and latest vocab entry / quiz / payment
        DateTime? lastActivity = null;
        var lastVocab = await db.VocabularyEntries
            .Where(v => v.UserId == user.Id)
            .OrderByDescending(v => v.DateAddedUtc)
            .Select(v => (DateTime?)v.DateAddedUtc)
            .FirstOrDefaultAsync(ct);
        if (lastVocab.HasValue) lastActivity = lastVocab.Value;
        if (payments.Count > 0 && (!lastActivity.HasValue || payments[0].PurchasedAtUtc > lastActivity.Value))
        {
            lastActivity = payments[0].PurchasedAtUtc;
        }

        return new UserDetailDto
        {
            TelegramId = user.TelegramId,
            UserId = user.Id,
            IsPro = user.IsPro,
            IsActive = user.IsActive,
            SubscriptionPlan = user.SubscriptionPlan?.ToString(),
            SubscribedUntilUtc = user.SubscribedUntil,
            ProPurchasedAtUtc = user.ProPurchasedAtUtc,
            RegisteredAtUtc = user.RegisteredAtUtc,
            CurrentLanguage = user.Settings?.CurrentLanguage.ToString() ?? "Unknown",
            VocabularyCount = vocabCount,
            Xp = progress?.Xp ?? 0,
            Streak = progress?.Streak ?? 0,
            Level = progress?.Level ?? "n/a",
            LastActivityUtc = lastActivity,
            Payments = payments
        };
    }
}

public class UserDetailDto
{
    public long TelegramId { get; init; }
    public Guid UserId { get; init; }
    public bool IsPro { get; init; }
    public bool IsActive { get; init; }
    public string? SubscriptionPlan { get; init; }
    public DateTime? SubscribedUntilUtc { get; init; }
    public DateTime? ProPurchasedAtUtc { get; init; }
    public DateTime RegisteredAtUtc { get; init; }
    public string CurrentLanguage { get; init; } = "Unknown";
    public int VocabularyCount { get; init; }
    public int Xp { get; init; }
    public int Streak { get; init; }
    public string Level { get; init; } = "n/a";
    public DateTime? LastActivityUtc { get; init; }
    public List<PaymentDto> Payments { get; init; } = new();
}

public class PaymentDto
{
    public string ChargeId { get; init; } = string.Empty;
    public string Plan { get; init; } = string.Empty;
    public int Amount { get; init; }
    public string Currency { get; init; } = string.Empty;
    public DateTime PurchasedAtUtc { get; init; }
    public DateTime? RefundedAtUtc { get; init; }
}
