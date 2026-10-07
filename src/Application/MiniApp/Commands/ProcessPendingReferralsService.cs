using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Commands;

/// <summary>
/// Polls the Referrals table for pending (not yet activated) referrals and checks
/// whether the referee has met an activation trigger. Called periodically by a
/// hosted service — no coupling to any existing command/handler.
///
/// Triggers:
/// - "first_lesson" — referee completed at least one non-vocabulary lesson
/// - "vocab_5"      — referee has 5+ vocabulary entries
/// - "purchase"     — referee has at least one payment record
/// </summary>
public class ProcessPendingReferralsService(
    ITraleDbContext db,
    TryActivateReferralService activator,
    IUserNotificationService notifications,
    ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<ProcessPendingReferralsService>();

    private const int VocabActivationThreshold = 5;

    public async Task<int> ExecuteAsync(CancellationToken ct)
    {
        var pendingReferrals = await db.Referrals
            .Where(r => r.ActivatedAtUtc == null)
            .ToListAsync(ct);

        if (pendingReferrals.Count == 0) return 0;

        var activated = 0;

        foreach (var referral in pendingReferrals)
        {
            var trigger = await DetectTriggerAsync(referral.RefereeUserId, ct);
            if (trigger == null) continue;

            var activation = await activator.ActivateAsync(referral, trigger, ct);
            var result = activation.Result;
            if (result == TryActivateReferralResult.Activated)
            {
                activated++;
                await NotifyReferrerAsync(activation, ct);
            }
            else if (result != TryActivateReferralResult.TooEarly)
            {
                _logger.LogInformation(
                    "Pending referral {ReferralId} trigger={Trigger} skipped: {Result}",
                    referral.Id, trigger, result);
            }
        }

        if (activated > 0)
        {
            _logger.LogInformation("Processed {Pending} pending referrals, activated {Activated}",
                pendingReferrals.Count, activated);
        }

        return activated;
    }

    /// <summary>Tells the referrer what they got. The bonus is already saved: a Telegram failure
    /// (bot blocked, network, rate limit) must not undo it or stop the batch.</summary>
    private async Task NotifyReferrerAsync(ReferralActivation activation, CancellationToken ct)
    {
        if (activation.Referrer == null || activation.Bonus == ReferralBonusKind.None
            || activation.AccessUntilUtc == null || !activation.Referrer.IsActive)
        {
            return;
        }

        try
        {
            await notifications.SendReferralBonusGrantedAsync(
                activation.Referrer, activation.Bonus, activation.Days, activation.AccessUntilUtc.Value, ct);
            // A 403 from Telegram flags the referrer inactive — persist that.
            await db.SaveChangesAsync(ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Referral bonus notification failed for referrer {Referrer}",
                activation.Referrer.Id);
        }
    }

    private async Task<string?> DetectTriggerAsync(Guid refereeUserId, CancellationToken ct)
    {
        // Strongest signal first: purchase
        var hasPurchase = await db.Payments.AnyAsync(p => p.UserId == refereeUserId, ct);
        if (hasPurchase) return "purchase";

        // Lesson completion: parse CompletedLessonsJson for any non-vocabulary module
        var progress = await db.MiniAppUserProgresses
            .FirstOrDefaultAsync(p => p.UserId == refereeUserId, ct);
        if (progress != null && HasCompletedNonVocabLesson(progress.CompletedLessonsJson))
        {
            return "first_lesson";
        }

        // Vocabulary count
        var vocabCount = await db.VocabularyEntries
            .CountAsync(v => v.UserId == refereeUserId, ct);
        if (vocabCount >= VocabActivationThreshold) return "vocab_5";

        return null;
    }

    private static bool HasCompletedNonVocabLesson(string completedLessonsJson)
    {
        if (string.IsNullOrWhiteSpace(completedLessonsJson) || completedLessonsJson == "{}")
            return false;

        try
        {
            using var doc = JsonDocument.Parse(completedLessonsJson);
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Name == "vocabulary") continue;
                if (prop.Value.ValueKind == JsonValueKind.Array && prop.Value.GetArrayLength() > 0)
                    return true;
            }
        }
        catch
        {
            // Malformed JSON — treat as no lessons completed
        }

        return false;
    }
}
