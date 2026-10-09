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

        var now = DateTime.UtcNow;
        var lastStudied = (await UserActivity.LoadLastAsync(db, ct)).TryGetValue(user.Id, out var studiedAt) ? studiedAt : (DateTime?)null;
        var lessons = 0;
        try
        {
            lessons = System.Text.Json.JsonSerializer
                .Deserialize<Dictionary<string, List<int>>>(progress?.CompletedLessonsJson ?? "{}")?.Sum(m => m.Value.Count) ?? 0;
        }
        catch (System.Text.Json.JsonException)
        {
            // An unreadable progress record must not hide the person's card.
        }

        // What the person said in surveys: every answer, with the question as it was asked.
        var answers = await db.UserFeedback.AsNoTracking()
            .Where(f => f.UserId == user.Id && f.Kind == Domain.Entities.UserFeedbackKind.Survey)
            .OrderByDescending(f => f.UpdatedAtUtc ?? f.CreatedAtUtc)
            .ToListAsync(ct);
        var keys = answers.Select(a => a.CampaignKey).Distinct().ToList();
        var surveys = (await db.BroadcastCampaigns.AsNoTracking().Where(c => keys.Contains(c.Key)).ToListAsync(ct))
            .ToDictionary(c => c.Key, c => c.Survey);

        return new UserDetailDto
        {
            AcquisitionSource = user.AcquisitionSource,
            Access = GetAdminUsersQuery.AccessOf(user, now).ToString(),
            AccessUntilUtc = user.HasActivePro(now) ? user.SubscribedUntil : user.HasActiveTrial(now) ? user.TrialEndsAtUtc : null,
            NotificationsEnabled = user.NotificationsEnabled,
            LastStudiedAtUtc = lastStudied,
            LessonsCompleted = lessons,
            QuizzesStarted = await db.Quizzes.CountAsync(q => q.UserId == user.Id, ct),
            VerbSessionsStarted = await db.VerbSessions.CountAsync(s => s.UserId == user.Id, ct),
            VerbSessionsFinished = await db.VerbSessions.CountAsync(s => s.UserId == user.Id && s.FinishedAtUtc != null, ct),
            WrittenTexts = await db.UserFeedback.CountAsync(f => f.UserId == user.Id && f.Text != null, ct),
            SurveyAnswers = answers.Select(a =>
            {
                surveys.TryGetValue(a.CampaignKey ?? "", out var survey);
                return new UserSurveyAnswerDto
                {
                    CampaignKey = a.CampaignKey ?? "", Question = survey?.Question(a.QuestionId)?.Text ?? "", Option = a.Option, Text = a.Text,
                    AtUtc = a.UpdatedAtUtc ?? a.CreatedAtUtc
                };
            }).ToList(),
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

    /// <summary>Where the person came from: a link tag, a referral, a campaign; null — unknown.</summary>
    public string? AcquisitionSource { get; init; }
    /// <summary>Paying / Trial / Ended / Lapsed — by the same rules the mini-app's paywall uses.</summary>
    public string Access { get; init; } = "Ended";
    /// <summary>When the access they have now ends; null — no access, or it never ends.</summary>
    public DateTime? AccessUntilUtc { get; init; }
    public bool NotificationsEnabled { get; init; }
    /// <summary>The latest dated trace of studying (<see cref="UserActivity"/>); null — none.</summary>
    public DateTime? LastStudiedAtUtc { get; init; }
    public int LessonsCompleted { get; init; }
    public int QuizzesStarted { get; init; }
    public int VerbSessionsStarted { get; init; }
    public int VerbSessionsFinished { get; init; }
    /// <summary>Texts the person wrote: letters, own words in surveys, comments at the paywall — the conversation.</summary>
    public int WrittenTexts { get; init; }
    public List<UserSurveyAnswerDto> SurveyAnswers { get; init; } = new();
}

public class UserSurveyAnswerDto
{
    public string CampaignKey { get; init; } = string.Empty;
    public string Question { get; init; } = string.Empty;
    public string? Option { get; init; }
    public string? Text { get; init; }
    public DateTime AtUtc { get; init; }
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
