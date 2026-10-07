using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Admin;

/// <summary>
/// Owner-only: a broadcast that can be sent safely in parts and measured afterwards.
///
/// Nothing here runs by itself. Two separate manual steps:
/// 1. <see cref="PrepareAsync"/> picks recipients (a random sample or everyone left) and writes
///    them down as Pending rows — no message leaves;
/// 2. <see cref="SendBatchAsync"/> sends a bounded batch of Pending rows and stops.
///
/// "Never twice" rests on the unique (campaign, user) row plus an atomic Pending → Sending claim
/// before each send. A row whose send did not report back stays Sending and is not retried.
/// The older one-shot <see cref="BroadcastService"/> has none of this: it sends to the whole
/// segment inside one request, without pauses, records or protection from a repeated request.
/// </summary>
public partial class BroadcastCampaignService(
    ITraleDbContext db,
    ICampaignMessageSender sender,
    ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<BroadcastCampaignService>();

    public const int MaxMessageLength = 4000;
    /// <summary>One request sends at most this many — it has to finish well inside an HTTP timeout.</summary>
    public const int MaxBatchSize = 100;
    /// <summary>Pause between messages: 10 per second, three times under Telegram's bulk limit (~30/s),
    /// so the bot's own pushes and replies still fit.</summary>
    public static readonly TimeSpan SendDelay = TimeSpan.FromMilliseconds(100);

    [GeneratedRegex("^[a-z0-9][a-z0-9_-]{2,47}$")]
    private static partial Regex KeyPattern();

    [GeneratedRegex("^[A-Za-z0-9_.~%=&-]{0,256}$")]
    private static partial Regex ButtonQueryPattern();

    /// <summary>How many people each audience has right now. Read-only.</summary>
    public async Task<IReadOnlyDictionary<BroadcastAudience, int>> CountAudiencesAsync(
        long ownerTelegramId, CancellationToken ct)
    {
        var users = await LoadReachableUsersAsync(ct);
        var now = DateTime.UtcNow;
        return Enum.GetValues<BroadcastAudience>()
            .ToDictionary(a => a, a => users.Count(u => IsIn(u, a, now, ownerTelegramId)));
    }

    /// <summary>
    /// Picks recipients for the campaign and records them as Pending. Sends nothing.
    /// <paramref name="sampleSize"/> — take that many at random from those not picked yet;
    /// null — take everyone not picked yet (the "rest"). With <paramref name="dryRun"/> only counts.
    /// Safe to repeat: people already in the campaign are never picked again.
    /// </summary>
    public async Task<CampaignPrepareResult> PrepareAsync(
        CampaignDraft draft, int? sampleSize, bool dryRun, long ownerTelegramId, CancellationToken ct)
    {
        var key = (draft.Key ?? "").Trim();
        var message = (draft.Message ?? "").Trim();
        var buttonText = string.IsNullOrWhiteSpace(draft.ButtonText) ? null : draft.ButtonText.Trim();
        var buttonQuery = (draft.ButtonQuery ?? "").Trim().TrimStart('?');

        if (!KeyPattern().IsMatch(key))
            return CampaignPrepareResult.Fail("Имя кампании: 3–48 символов, латиница в нижнем регистре, цифры, «-» и «_».");
        if (message.Length == 0) return CampaignPrepareResult.Fail("Пустое сообщение.");
        if (message.Length > MaxMessageLength) return CampaignPrepareResult.Fail($"Сообщение длиннее {MaxMessageLength} символов.");
        if (buttonText is { Length: > 64 }) return CampaignPrepareResult.Fail("Текст кнопки длиннее 64 символов.");
        if (!ButtonQueryPattern().IsMatch(buttonQuery))
            return CampaignPrepareResult.Fail("Адрес для кнопки — только параметры вида screen=vocabulary, без пробелов и «?».");
        if (buttonText == null && buttonQuery.Length > 0)
            return CampaignPrepareResult.Fail("Указан адрес для кнопки, но нет её текста.");
        if (sampleSize is <= 0) return CampaignPrepareResult.Fail("Размер пробной группы должен быть больше нуля.");

        var campaign = await db.BroadcastCampaigns.FirstOrDefaultAsync(c => c.Key == key, ct);
        if (campaign != null && campaign.Audience != draft.Audience)
            return CampaignPrepareResult.Fail($"Кампания «{key}» уже заведена для другой аудитории ({campaign.Audience}). Возьми другое имя.");

        var contentChanged = campaign != null
            && (campaign.Message != message || campaign.ButtonText != buttonText || (campaign.ButtonQuery ?? "") != buttonQuery);
        if (contentChanged)
        {
            // The text may change between parts (after looking at the sample), but never under a
            // part that is already picked and waiting: those people were picked for the old text.
            var waiting = await db.BroadcastDeliveries.CountAsync(
                d => d.CampaignId == campaign!.Id && d.Status == BroadcastDeliveryStatus.Pending, ct);
            if (waiting > 0)
                return CampaignPrepareResult.Fail($"У кампании «{key}» {waiting} получателей ждут отправки со старым текстом. Сначала отправь их.");
        }

        var now = DateTime.UtcNow;
        var users = await LoadReachableUsersAsync(ct);
        var audience = users.Where(u => IsIn(u, draft.Audience, now, ownerTelegramId)).ToList();

        var alreadyPicked = campaign == null
            ? new HashSet<Guid>()
            : (await db.BroadcastDeliveries.Where(d => d.CampaignId == campaign.Id).Select(d => d.UserId).ToListAsync(ct)).ToHashSet();
        var candidates = audience.Where(u => !alreadyPicked.Contains(u.Id)).ToList();

        // Random order, so the sample is not "the oldest accounts" or "the newest".
        var shuffled = candidates.ToArray();
        Random.Shared.Shuffle(shuffled);
        var picked = sampleSize.HasValue ? shuffled.Take(sampleSize.Value).ToArray() : shuffled;

        var result = new CampaignPrepareResult
        {
            Key = key,
            DryRun = dryRun,
            AudienceTotal = audience.Count,
            AlreadyInCampaign = audience.Count - candidates.Count,
            Picked = picked.Length,
            LeftForLater = candidates.Count - picked.Length
        };
        if (dryRun) return result;

        if (campaign == null)
        {
            campaign = new BroadcastCampaign { Id = Guid.NewGuid(), Key = key, Audience = draft.Audience, CreatedAtUtc = now };
            db.BroadcastCampaigns.Add(campaign);
        }
        campaign.Message = message;
        campaign.ButtonText = buttonText;
        campaign.ButtonQuery = buttonQuery;

        foreach (var user in picked)
        {
            db.BroadcastDeliveries.Add(new BroadcastDelivery
            {
                Id = Guid.NewGuid(),
                CampaignId = campaign.Id,
                UserId = user.Id,
                TelegramId = user.TelegramId,
                IsSample = sampleSize.HasValue,
                Status = BroadcastDeliveryStatus.Pending,
                CreatedAtUtc = now
            });
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            // Two overlapping requests picked the same people — the unique index let one through.
            _logger.LogWarning(ex, "Campaign {Key}: recipients were picked by a parallel request", key);
            return CampaignPrepareResult.Fail("Получателей этой кампании только что выбрал параллельный запрос. Обнови статус.");
        }

        _logger.LogInformation("Campaign {Key}: picked {Picked} of {AudienceTotal} ({Audience}), sample={Sample}",
            key, picked.Length, audience.Count, draft.Audience, sampleSize.HasValue);
        return result;
    }

    /// <summary>
    /// Sends up to <paramref name="limit"/> Pending messages of the campaign and stops. Call again
    /// for the next part. Stops early when Telegram asks to slow down (429) — the message it
    /// refused goes back to Pending, the answer says how long to wait.
    /// </summary>
    public async Task<CampaignSendResult> SendBatchAsync(string key, int limit, CancellationToken ct)
    {
        var campaign = await db.BroadcastCampaigns.FirstOrDefaultAsync(c => c.Key == key, ct);
        if (campaign == null) return new CampaignSendResult { Error = $"Кампании «{key}» нет." };

        limit = Math.Clamp(limit, 1, MaxBatchSize);
        var batch = await db.BroadcastDeliveries
            .Where(d => d.CampaignId == campaign.Id && d.Status == BroadcastDeliveryStatus.Pending)
            .OrderBy(d => d.CreatedAtUtc).ThenBy(d => d.Id)
            .Take(limit)
            .ToListAsync(ct);

        var result = new CampaignSendResult();
        foreach (var delivery in batch)
        {
            // The request was dropped (owner closed the page, proxy timeout): stop between
            // messages, never in the middle of one.
            if (ct.IsCancellationRequested) break;

            if (!await db.TryClaimBroadcastDeliveryAsync(delivery.Id, ct)) continue; // another request took it
            await db.Entry(delivery).ReloadAsync(CancellationToken.None);

            var outcome = await sender.SendAsync(
                delivery.TelegramId, campaign.Message, campaign.ButtonText, campaign.ButtonQuery, campaign.Key, CancellationToken.None);

            switch (outcome.Outcome)
            {
                case CampaignSendOutcome.Sent:
                    delivery.Status = BroadcastDeliveryStatus.Sent;
                    delivery.SentAtUtc = DateTime.UtcNow;
                    result.Sent++;
                    break;
                case CampaignSendOutcome.Blocked:
                    delivery.Status = BroadcastDeliveryStatus.Blocked;
                    delivery.Error = Trim(outcome.Error);
                    result.Blocked++;
                    // Same as the notification pushes: a blocked bot means the user is unreachable.
                    var user = await db.Users.FirstOrDefaultAsync(u => u.Id == delivery.UserId, CancellationToken.None);
                    if (user != null) user.IsActive = false;
                    break;
                case CampaignSendOutcome.RateLimited:
                    // Telegram refused it — it did not leave, so it may be sent later.
                    delivery.Status = BroadcastDeliveryStatus.Pending;
                    result.RetryAfterSeconds = Math.Max(outcome.RetryAfterSeconds, 1);
                    break;
                case CampaignSendOutcome.Rejected:
                    delivery.Status = BroadcastDeliveryStatus.Rejected;
                    delivery.Error = Trim(outcome.Error);
                    result.Rejected++;
                    break;
                default:
                    // No answer from Telegram: the message may or may not have left. Stays Sending.
                    delivery.Error = Trim(outcome.Error);
                    result.Unknown++;
                    break;
            }

            // The message is out — the record of it must be written even if the request is gone.
            await db.SaveChangesAsync(CancellationToken.None);

            if (result.RetryAfterSeconds > 0) break;
            await Task.Delay(SendDelay, CancellationToken.None);
        }

        result.Status = await GetStatusAsync(key, CancellationToken.None);
        _logger.LogInformation(
            "Campaign {Key} batch: sent={Sent} blocked={Blocked} rejected={Rejected} unknown={Unknown} retryAfter={RetryAfter}s",
            key, result.Sent, result.Blocked, result.Rejected, result.Unknown, result.RetryAfterSeconds);
        return result;
    }

    public async Task<CampaignStatus?> GetStatusAsync(string key, CancellationToken ct)
    {
        var campaign = await db.BroadcastCampaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Key == key, ct);
        if (campaign == null) return null;

        var rows = await db.BroadcastDeliveries.AsNoTracking()
            .Where(d => d.CampaignId == campaign.Id)
            .Select(d => new { d.Status, d.IsSample, Opened = d.OpenedAtUtc != null })
            .ToListAsync(ct);

        return new CampaignStatus
        {
            Key = campaign.Key,
            Audience = campaign.Audience,
            Message = campaign.Message,
            ButtonText = campaign.ButtonText,
            ButtonQuery = campaign.ButtonQuery,
            CreatedAtUtc = campaign.CreatedAtUtc,
            Total = rows.Count,
            Sample = rows.Count(r => r.IsSample),
            Pending = rows.Count(r => r.Status == BroadcastDeliveryStatus.Pending),
            Sent = rows.Count(r => r.Status == BroadcastDeliveryStatus.Sent),
            Blocked = rows.Count(r => r.Status == BroadcastDeliveryStatus.Blocked),
            Rejected = rows.Count(r => r.Status == BroadcastDeliveryStatus.Rejected),
            Unknown = rows.Count(r => r.Status == BroadcastDeliveryStatus.Sending),
            Opened = rows.Count(r => r.Opened)
        };
    }

    /// <summary>The user opened the mini-app by the campaign's button. First open only.</summary>
    public async Task<bool> MarkOpenedAsync(Guid userId, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || !KeyPattern().IsMatch(key)) return false;

        var delivery = await db.BroadcastDeliveries
            .Where(d => d.UserId == userId && d.OpenedAtUtc == null && d.Status == BroadcastDeliveryStatus.Sent
                        && db.BroadcastCampaigns.Any(c => c.Id == d.CampaignId && c.Key == key))
            .FirstOrDefaultAsync(ct);
        if (delivery == null) return false;

        delivery.OpenedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>People a broadcast may reach at all: have not blocked the bot and have not turned
    /// notifications off in the profile.</summary>
    private Task<List<User>> LoadReachableUsersAsync(CancellationToken ct) =>
        db.Users.AsNoTracking().Where(u => u.IsActive && u.NotificationsEnabled).ToListAsync(ct);

    /// <summary>Audience membership through the entitlement helpers on <see cref="User"/> — the
    /// same ones the mini-app's paywall uses, so "access ended" here is exactly "sees the paywall".</summary>
    public static bool IsIn(User user, BroadcastAudience audience, DateTime now, long ownerTelegramId) => audience switch
    {
        BroadcastAudience.AccessEnded => !user.IsPro && !user.HasActiveTrial(now),
        BroadcastAudience.OnTrial => user.HasActiveTrial(now),
        BroadcastAudience.Paying => user.HasActivePro(now),
        BroadcastAudience.ProLapsed => user.HasExpiredPro(now),
        BroadcastAudience.Owner => user.TelegramId == ownerTelegramId,
        _ => false
    };

    private static string? Trim(string? error) => error is { Length: > 500 } ? error[..500] : error;
}

public class CampaignDraft
{
    public string? Key { get; init; }
    public BroadcastAudience Audience { get; init; }
    public string? Message { get; init; }
    public string? ButtonText { get; init; }
    public string? ButtonQuery { get; init; }
}

public class CampaignPrepareResult
{
    public string? Key { get; init; }
    public bool DryRun { get; init; }
    /// <summary>Reachable people in the audience right now.</summary>
    public int AudienceTotal { get; init; }
    /// <summary>Of them, already picked for this campaign earlier.</summary>
    public int AlreadyInCampaign { get; init; }
    /// <summary>Picked by this call (with dryRun — would be picked).</summary>
    public int Picked { get; init; }
    /// <summary>In the audience, not picked yet.</summary>
    public int LeftForLater { get; init; }
    public string? Error { get; init; }

    public static CampaignPrepareResult Fail(string error) => new() { Error = error };
}

public class CampaignSendResult
{
    public int Sent { get; set; }
    public int Blocked { get; set; }
    public int Rejected { get; set; }
    public int Unknown { get; set; }
    /// <summary>Non-zero — Telegram asked to wait this long before the next batch.</summary>
    public int RetryAfterSeconds { get; set; }
    public CampaignStatus? Status { get; set; }
    public string? Error { get; init; }
}

public class CampaignStatus
{
    public string Key { get; init; } = "";
    public BroadcastAudience Audience { get; init; }
    public string Message { get; init; } = "";
    public string? ButtonText { get; init; }
    public string? ButtonQuery { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public int Total { get; init; }
    public int Sample { get; init; }
    public int Pending { get; init; }
    public int Sent { get; init; }
    public int Blocked { get; init; }
    public int Rejected { get; init; }
    /// <summary>Claimed for sending, no answer recorded — may or may not have been delivered.</summary>
    public int Unknown { get; init; }
    public int Opened { get; init; }
}

public enum CampaignSendOutcome
{
    Sent,
    Blocked,
    RateLimited,
    Rejected,
    Unknown
}

public record CampaignSendAttempt(CampaignSendOutcome Outcome, int RetryAfterSeconds = 0, string? Error = null);

/// <summary>Sends one campaign message and says what Telegram answered. Never throws.</summary>
public interface ICampaignMessageSender
{
    /// <param name="buttonText">Null — no button.</param>
    /// <param name="buttonQuery">Query string for the mini-app URL the button opens; the campaign
    /// key is appended as <c>c=…</c> so an open can be attributed.</param>
    Task<CampaignSendAttempt> SendAsync(
        long telegramId, string text, string? buttonText, string? buttonQuery, string campaignKey, CancellationToken ct);
}
