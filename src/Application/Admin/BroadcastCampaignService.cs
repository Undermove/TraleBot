using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Feedback;
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
    public const int MaxGiftDays = 30;
    /// <summary>How long after the campaign is created an open still gives the gift, unless said otherwise.</summary>
    public const int DefaultGiftOfferDays = 14;
    public const int MaxGiftOfferDays = 90;
    public const int MaxSurveyOptions = 4;
    /// <summary>A survey option is a button caption and the stored answer.</summary>
    public const int MaxSurveyOptionLength = 64;
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
        if (draft.GiftDays is < 0 or > MaxGiftDays)
            return CampaignPrepareResult.Fail($"Подарок — от 0 до {MaxGiftDays} дней доступа.");
        if (draft.GiftDays > 0 && buttonText == null)
            return CampaignPrepareResult.Fail("Подарок получают, открыв мини-апп кнопкой из сообщения, — нужна кнопка.");
        var giftOfferDays = draft.GiftOfferDays ?? DefaultGiftOfferDays;
        if (giftOfferDays is < 1 or > MaxGiftOfferDays)
            return CampaignPrepareResult.Fail($"Срок, пока подарок можно получить, — от 1 до {MaxGiftOfferDays} дней.");

        var surveyOptions = (draft.SurveyOptions ?? []).Select(o => (o ?? "").Trim()).Where(o => o.Length > 0).ToArray();
        if (surveyOptions.Length > 0)
        {
            if (surveyOptions.Length is < 2 or > MaxSurveyOptions)
                return CampaignPrepareResult.Fail($"В опросе от 2 до {MaxSurveyOptions} вариантов ответа.");
            if (surveyOptions.Any(o => o.Length > MaxSurveyOptionLength))
                return CampaignPrepareResult.Fail($"Вариант ответа длиннее {MaxSurveyOptionLength} символов.");
            if (surveyOptions.Distinct().Count() != surveyOptions.Length)
                return CampaignPrepareResult.Fail("Варианты ответа повторяются.");
            if (buttonText != null || draft.GiftDays > 0)
                return CampaignPrepareResult.Fail("У опроса кнопки — это варианты ответа: кнопку мини-аппа и подарок к нему не добавить.");
        }

        var campaign = await db.BroadcastCampaigns.FirstOrDefaultAsync(c => c.Key == key, ct);
        if (campaign != null && campaign.Audience != draft.Audience)
            return CampaignPrepareResult.Fail($"Кампания «{key}» уже заведена для другой аудитории ({campaign.Audience}). Возьми другое имя.");
        // A button carries the number of its option, and answers are counted by the option's text:
        // both would point at something else if the options changed under messages already picked.
        if (campaign != null && !(campaign.SurveyOptions ?? []).SequenceEqual(surveyOptions))
            return CampaignPrepareResult.Fail($"Варианты ответа кампании «{key}» менять нельзя — получатели уже выбраны. Заведи кампанию с другим именем.");

        var contentChanged = campaign != null
            && (campaign.Message != message || campaign.ButtonText != buttonText || (campaign.ButtonQuery ?? "") != buttonQuery
                || campaign.GiftDays != draft.GiftDays);
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
        campaign.GiftDays = draft.GiftDays;
        campaign.SurveyOptions = surveyOptions.Length > 0 ? surveyOptions : null;
        // The offer runs from the day the campaign was created, whichever part a person is in.
        campaign.GiftOfferEndsAtUtc = draft.GiftDays > 0 ? campaign.CreatedAtUtc.AddDays(giftOfferDays) : null;

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
                delivery.TelegramId, campaign.Message, campaign.ButtonText, campaign.ButtonQuery, campaign.Key,
                campaign.SurveyOptions, CancellationToken.None);

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
            .Select(d => new { d.Status, d.IsSample, Opened = d.OpenedAtUtc != null, Gifted = d.GiftGrantedAtUtc != null })
            .ToListAsync(ct);

        // What the people who opened the button did next: played a verb session, paid.
        var opened = db.BroadcastDeliveries.AsNoTracking().Where(d => d.CampaignId == campaign.Id && d.OpenedAtUtc != null);
        var played = await opened.CountAsync(d => db.VerbSessions.Any(s => s.UserId == d.UserId && s.StartedAtUtc >= d.OpenedAtUtc), ct);
        var finished = await opened.CountAsync(
            d => db.VerbSessions.Any(s => s.UserId == d.UserId && s.FinishedAtUtc != null && s.StartedAtUtc >= d.OpenedAtUtc), ct);
        var paid = await opened.CountAsync(
            d => db.Payments.Any(p => p.UserId == d.UserId && p.PurchasedAtUtc >= d.OpenedAtUtc && p.RefundedAtUtc == null), ct);

        // A survey: how many people chose each option.
        var answers = await db.UserFeedback.AsNoTracking()
            .Where(f => f.Kind == UserFeedbackKind.Survey && f.CampaignKey == campaign.Key)
            .GroupBy(f => f.Option)
            .Select(g => new { Option = g.Key, Count = g.Count() })
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
            Opened = rows.Count(r => r.Opened),
            GiftDays = campaign.GiftDays,
            GiftOfferEndsAtUtc = campaign.GiftOfferEndsAtUtc,
            Gifted = rows.Count(r => r.Gifted),
            SurveyAnswers = (campaign.SurveyOptions ?? [])
                .Select(o => new OptionCount(o, answers.FirstOrDefault(a => a.Option == o)?.Count ?? 0)).ToList(),
            PlayedVerbSession = played,
            FinishedVerbSession = finished,
            PaidAfterOpen = paid
        };
    }

    /// <summary>
    /// The user opened the mini-app by the campaign's button. The open is recorded once. If the
    /// campaign carries a gift of access and its offer has not ended, the gift is given here — at
    /// the open, so the days do not burn in an unread message — and at most once per recipient,
    /// however many times, from however many devices or replicas the open is reported.
    /// Only a recipient of the campaign counts: for anyone else (a forwarded link) nothing is
    /// recorded and nothing is given — the mini-app simply opens as usual.
    /// </summary>
    public async Task<CampaignOpenResult> MarkOpenedAsync(Guid userId, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || !KeyPattern().IsMatch(key)) return CampaignOpenResult.Nothing;

        var campaign = await db.BroadcastCampaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Key == key, ct);
        if (campaign == null) return CampaignOpenResult.Nothing;

        // Sending = the send did not report back; an open by the button proves the message arrived.
        var delivery = await db.BroadcastDeliveries.FirstOrDefaultAsync(
            d => d.CampaignId == campaign.Id && d.UserId == userId
                 && (d.Status == BroadcastDeliveryStatus.Sent || d.Status == BroadcastDeliveryStatus.Sending), ct);
        if (delivery == null) return CampaignOpenResult.Nothing;

        var now = DateTime.UtcNow;
        var firstOpen = delivery.OpenedAtUtc == null;
        if (firstOpen)
        {
            delivery.OpenedAtUtc = now;
            await db.SaveChangesAsync(ct);
        }

        var gift = delivery.GiftGrantedAtUtc == null && campaign.GiftOffered(now)
            ? await GiveGiftAsync(delivery.Id, userId, campaign, now, ct)
            : null;
        return new CampaignOpenResult(firstOpen, gift);
    }

    /// <summary>
    /// Gives the campaign's gift to one recipient. The mark on the delivery row and the change of the
    /// user's access are one transaction, and the mark is an atomic claim: of several parallel calls
    /// exactly one changes the user. Nothing is marked when the person already has that much access,
    /// so the offer stays open for them until its deadline.
    /// </summary>
    private async Task<CampaignGift?> GiveGiftAsync(
        Guid deliveryId, Guid userId, BroadcastCampaign campaign, DateTime now, CancellationToken ct)
    {
        await using var transaction = await db.BeginTransactionAsync(ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return null;
        await db.Entry(user).ReloadAsync(ct);

        var until = user.GiftAccessDays(campaign.GiftDays, now);
        if (until == null) return null;
        if (!await db.TryClaimCampaignGiftAsync(deliveryId, now, until.Value, ct))
        {
            // A parallel open has given it; forget this copy of the change.
            await db.Entry(user).ReloadAsync(ct);
            return null;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        _logger.LogInformation("Campaign {Key}: gift of {Days} days given to {User}, access until {Until}",
            campaign.Key, campaign.GiftDays, userId, until);
        return new CampaignGift(campaign.GiftDays, until.Value);
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
    /// <summary>Days of access given to a recipient who opens the button; 0 — no gift.</summary>
    public int GiftDays { get; init; }
    /// <summary>For how many days after the campaign is created an open still gives the gift;
    /// null — <see cref="BroadcastCampaignService.DefaultGiftOfferDays"/>.</summary>
    public int? GiftOfferDays { get; init; }
    /// <summary>Answer options of a survey, 2 to <see cref="BroadcastCampaignService.MaxSurveyOptions"/>;
    /// null or empty — an ordinary campaign.</summary>
    public IReadOnlyList<string>? SurveyOptions { get; init; }
}

/// <summary>A gift of access given by a campaign: how many days and until when the person now has access.</summary>
public record CampaignGift(int Days, DateTime AccessUntilUtc);

/// <param name="FirstOpen">This call recorded the recipient's first open.</param>
/// <param name="Gift">The gift given by this very call; null on every later call.</param>
public record CampaignOpenResult(bool FirstOpen, CampaignGift? Gift)
{
    public static readonly CampaignOpenResult Nothing = new(false, null);
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
    public int GiftDays { get; init; }
    public DateTime? GiftOfferEndsAtUtc { get; init; }
    /// <summary>Recipients the gift was given to.</summary>
    public int Gifted { get; init; }
    /// <summary>For a survey: its options in the order of the buttons, with how many people chose each.
    /// Empty for an ordinary campaign.</summary>
    public IReadOnlyList<OptionCount> SurveyAnswers { get; init; } = [];
    /// <summary>Of those who opened: started a verb session after the open.</summary>
    public int PlayedVerbSession { get; init; }
    /// <summary>Of those who opened: finished a verb session started after the open.</summary>
    public int FinishedVerbSession { get; init; }
    /// <summary>Of those who opened: paid after the open (refunds not counted).</summary>
    public int PaidAfterOpen { get; init; }
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
    /// <param name="surveyOptions">Not null — a survey: each option goes as its own answer button.</param>
    Task<CampaignSendAttempt> SendAsync(
        long telegramId, string text, string? buttonText, string? buttonQuery, string campaignKey,
        IReadOnlyList<string>? surveyOptions, CancellationToken ct);
}
