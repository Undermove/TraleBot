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
    /// <summary>"Active" and "inactive" audiences: whether the person did anything in this many days.</summary>
    public const int ActivityWindowDays = 30;
    /// <summary>Pause between messages: 10 per second, three times under Telegram's bulk limit (~30/s),
    /// so the bot's own pushes and replies still fit.</summary>
    public static readonly TimeSpan SendDelay = TimeSpan.FromMilliseconds(100);

    [GeneratedRegex("^[a-z0-9][a-z0-9_-]{2,47}$")]
    private static partial Regex KeyPattern();

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{1,23}$")]
    private static partial Regex SurveySlugPattern();

    [GeneratedRegex("^[A-Za-z0-9_.~%=&-]{0,256}$")]
    private static partial Regex ButtonQueryPattern();

    /// <summary>How many people each audience has right now. Read-only.</summary>
    public async Task<IReadOnlyDictionary<BroadcastAudience, int>> CountAudiencesAsync(
        long ownerTelegramId, CancellationToken ct)
    {
        var users = await LoadReachableUsersAsync(ct);
        var now = DateTime.UtcNow;
        var lastActive = await LoadLastActivityAsync(ct);
        return Enum.GetValues<BroadcastAudience>()
            .ToDictionary(a => a, a => users.Count(u => IsIn(u, a, now, ownerTelegramId, lastActive)));
    }

    /// <summary>
    /// Starts a new survey under a name the owner does not have to invent:
    /// <c>survey-2026-10-&lt;slug&gt;</c>, then <c>…-2</c>, <c>…-3</c> while the name is taken. The
    /// campaign is always a new one — recipients are never added to somebody else's survey; if a
    /// parallel request takes the name in between, this one fails and changes nothing.
    /// The later parts of the same survey go through <see cref="PrepareAsync"/> with the key from the answer.
    /// </summary>
    public async Task<CampaignPrepareResult> PrepareNewSurveyAsync(
        CampaignDraft draft, string? slug, int? sampleSize, bool dryRun, long ownerTelegramId, CancellationToken ct)
    {
        slug = (slug ?? "").Trim();
        if (!SurveySlugPattern().IsMatch(slug)) return CampaignPrepareResult.Fail("Неизвестная заготовка опроса.");
        if (draft.Survey == null) return CampaignPrepareResult.Fail("В опросе нет ни одного вопроса.");

        var stem = $"survey-{DateTime.UtcNow:yyyy-MM}-{slug}";
        var taken = (await db.BroadcastCampaigns.AsNoTracking()
            .Where(c => c.Key.StartsWith(stem)).Select(c => c.Key).ToListAsync(ct)).ToHashSet();
        var key = stem;
        for (var n = 2; taken.Contains(key); n++) key = $"{stem}-{n}";

        return await PrepareAsync(
            new CampaignDraft
            {
                Key = key, MustBeNew = true, Audience = draft.Audience, Survey = draft.Survey,
                ButtonText = draft.ButtonText, GiftDays = draft.GiftDays, GiftOfferDays = draft.GiftOfferDays
            },
            sampleSize, dryRun, ownerTelegramId, ct);
    }

    /// <summary>
    /// Starts a new ordinary campaign under a name the owner does not have to invent:
    /// <c>broadcast-2026-10</c>, then <c>…-2</c>, <c>…-3</c> while the name is taken (with
    /// <paramref name="suffix"/> — <c>broadcast-2026-10-test</c> for a trial sent to oneself).
    /// Always a new campaign; later parts go through <see cref="PrepareAsync"/> with the key from the answer.
    /// </summary>
    public async Task<CampaignPrepareResult> PrepareNewBroadcastAsync(
        CampaignDraft draft, string? suffix, int? sampleSize, bool dryRun, long ownerTelegramId, CancellationToken ct)
    {
        suffix = (suffix ?? "").Trim();
        if (suffix.Length > 0 && !SurveySlugPattern().IsMatch(suffix)) return CampaignPrepareResult.Fail("Неизвестная метка кампании.");
        if (draft.Survey != null) return CampaignPrepareResult.Fail("Опрос собирается в конструкторе опросов.");

        var stem = $"broadcast-{DateTime.UtcNow:yyyy-MM}" + (suffix.Length > 0 ? $"-{suffix}" : "");
        var taken = (await db.BroadcastCampaigns.AsNoTracking()
            .Where(c => c.Key.StartsWith(stem)).Select(c => c.Key).ToListAsync(ct)).ToHashSet();
        var key = stem;
        for (var n = 2; taken.Contains(key); n++) key = $"{stem}-{n}";

        return await PrepareAsync(
            new CampaignDraft
            {
                Key = key, MustBeNew = true, Audience = draft.Audience, Message = draft.Message, ButtonText = draft.ButtonText,
                ButtonQuery = draft.ButtonQuery, GiftDays = draft.GiftDays, GiftOfferDays = draft.GiftOfferDays
            },
            sampleSize, dryRun, ownerTelegramId, ct);
    }

    /// <summary>
    /// Every campaign, newest first, with how far it got — for the owner's lists. Trials the owner
    /// sent only to themselves are left out.
    /// </summary>
    public async Task<IReadOnlyList<CampaignListItem>> ListAsync(CancellationToken ct)
    {
        var campaigns = await db.BroadcastCampaigns.AsNoTracking()
            .Where(c => c.Audience != BroadcastAudience.Owner)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(ct);
        var ids = campaigns.Select(c => c.Id).ToList();
        var deliveries = await db.BroadcastDeliveries.AsNoTracking()
            .Where(d => ids.Contains(d.CampaignId))
            .GroupBy(d => d.CampaignId)
            .Select(g => new
            {
                CampaignId = g.Key,
                Picked = g.Count(),
                Pending = g.Count(d => d.Status == BroadcastDeliveryStatus.Pending),
                Sent = g.Count(d => d.Status == BroadcastDeliveryStatus.Sent),
                Opened = g.Count(d => d.OpenedAtUtc != null),
                Gifted = g.Count(d => d.GiftGrantedAtUtc != null)
            })
            .ToDictionaryAsync(g => g.CampaignId, ct);

        return campaigns.Select(c =>
        {
            deliveries.TryGetValue(c.Id, out var d);
            return new CampaignListItem(
                c.Key, c.IsSurvey, c.Message, c.Audience, c.CreatedAtUtc, c.ButtonText, c.GiftDays,
                d?.Picked ?? 0, d?.Pending ?? 0, d?.Sent ?? 0, d?.Opened ?? 0, d?.Gifted ?? 0);
        }).ToList();
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
        if (message.Length == 0 && draft.Survey == null) return CampaignPrepareResult.Fail("Пустое сообщение.");
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

        string? surveyJson = null;
        if (draft.Survey != null)
        {
            var withGift = draft.GiftDays > 0;
            var survey = SurveyFormRules.Normalize(draft.Survey, out var surveyError, firstInBot: !withGift);
            if (survey == null) return CampaignPrepareResult.Fail(surveyError!);
            if (buttonQuery.Length > 0)
                return CampaignPrepareResult.Fail("Куда ведёт кнопка опроса, решает сам опрос — адрес для неё не задаётся.");
            surveyJson = survey.ToJson();
            if (withGift)
            {
                // One button, pressing it gives the gift; every question — the first too — is in the mini-app.
                message = survey.Intro!;
                buttonQuery = BroadcastCampaign.GiftSurveyButtonQuery(key);
            }
            else
            {
                // Without a gift the buttons under the message are the answers to the first question.
                if (buttonText != null)
                    return CampaignPrepareResult.Fail("У опроса без подарка кнопки — это варианты ответа: кнопку мини-аппа к нему не добавить.");
                // What leaves is the intro and the first question; the rest is answered in the mini-app.
                message = survey.BotMessage();
            }
        }

        var campaign = await db.BroadcastCampaigns.FirstOrDefaultAsync(c => c.Key == key, ct);
        if (campaign != null && draft.MustBeNew)
            return CampaignPrepareResult.Fail("Опрос с таким именем только что завёл параллельный запрос. Попробуй ещё раз.");
        // Another audience may be added to a campaign only when asked for in so many words: it is the same
        // campaign, so nobody gets the message or the gift twice — which is the reason to add, not to start anew.
        if (campaign != null && campaign.Audience != draft.Audience && !draft.AnotherAudience)
            return CampaignPrepareResult.Fail($"Кампания «{key}» уже заведена для другой аудитории ({campaign.Audience}). Возьми другое имя.");
        // A button carries the number of its option, and answers are counted by the question's id and the
        // option's text: all would point at something else if the form changed under messages already picked.
        if (campaign != null && campaign.Survey?.ToJson() != surveyJson)
            return CampaignPrepareResult.Fail($"Вопросы и варианты кампании «{key}» менять нельзя — получатели уже выбраны. Заведи кампанию с другим именем.");

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
        var lastActive = await LoadLastActivityAsync(ct);
        var audience = users.Where(u => IsIn(u, draft.Audience, now, ownerTelegramId, lastActive)).ToList();

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
        campaign.SurveyJson = surveyJson;
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
                campaign.IsGiftSurvey ? null : campaign.Survey?.BotButtons(), CancellationToken.None);

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

        // A survey: how many people chose each option of its first question — the one answered in the bot.
        var survey = campaign.Survey;
        var firstQuestion = survey?.Questions[0].Id;
        var answers = await db.UserFeedback.AsNoTracking()
            .Where(f => f.Kind == UserFeedbackKind.Survey && f.CampaignKey == campaign.Key && f.QuestionId == firstQuestion)
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
            Survey = survey,
            SurveyAnswers = (survey?.BotButtons() ?? [])
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

        // A survey's gift is not for the open: it is given when the form is finished (FinishGiftSurveyAsync).
        var gift = delivery.GiftGrantedAtUtc == null && campaign.GiftOffered(now) && !campaign.IsGiftSurvey
            ? await GiveGiftAsync(delivery.Id, userId, campaign, now, ct)
            : null;
        return new CampaignOpenResult(firstOpen, gift);
    }

    /// <summary>
    /// The recipient opened the form of a survey that carries a gift. Opening by itself gives nothing —
    /// the gift is for going through the form (<see cref="FinishGiftSurveyAsync"/>); the answer says
    /// where the person stands, so the form can promise the gift, or say it has been given and until when.
    /// Null for a survey without a gift and for anyone but a recipient.
    /// </summary>
    public async Task<SurveyGiftState?> OpenGiftSurveyAsync(Guid userId, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || !KeyPattern().IsMatch(key)) return null;
        var campaign = await db.BroadcastCampaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Key == key, ct);
        if (campaign is not { IsGiftSurvey: true }) return null;

        await MarkOpenedAsync(userId, key, ct);
        return await GiftStateAsync(campaign, userId, ct);
    }

    /// <summary>
    /// The recipient reached the end of the form of a survey that carries a gift. The gift is given
    /// here — to someone who answered at least one question, at once, once per person per campaign,
    /// however many times and from however many devices the end is reported — and the answer says
    /// what the person has now: the days count from today, or were added to a subscription or a
    /// trial, or there was nothing to add them to (Lifetime), or no question was answered yet, or
    /// the offer is over. Call after the end of the form is recorded.
    /// Null for a survey without a gift and for anyone but a recipient.
    /// </summary>
    public async Task<SurveyGiftState?> FinishGiftSurveyAsync(Guid userId, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || !KeyPattern().IsMatch(key)) return null;
        var campaign = await db.BroadcastCampaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Key == key, ct);
        if (campaign is not { IsGiftSurvey: true }) return null;

        return await GiftStateAsync(campaign, userId, ct);
    }

    /// <summary>Gives the gift if it has been earned and not given yet, and says where the person stands.
    /// "Earned" is the end of the form reached plus at least one answer, in either order — so an answer
    /// added after an empty walk-through counts at the next end of the form or the next open.</summary>
    private async Task<SurveyGiftState?> GiftStateAsync(BroadcastCampaign campaign, Guid userId, CancellationToken ct)
    {
        var delivery = await db.BroadcastDeliveries.AsNoTracking().FirstOrDefaultAsync(
            d => d.CampaignId == campaign.Id && d.UserId == userId
                 && (d.Status == BroadcastDeliveryStatus.Sent || d.Status == BroadcastDeliveryStatus.Sending), ct);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (delivery == null || user == null) return null;

        var now = DateTime.UtcNow;
        var days = campaign.GiftDays;
        var trial = campaign.IsGiftSurveyTrial;
        // The deadline is for starting: whoever opened the form in time may finish it later.
        var offered = campaign.GiftOffered(delivery.SurveyOpenedAtUtc ?? now);
        var finished = delivery.SurveyFinishedAtUtc != null;
        var answered = await db.UserFeedback.AsNoTracking().AnyAsync(
            f => f.UserId == userId && f.Kind == UserFeedbackKind.Survey && f.CampaignKey == campaign.Key && f.QuestionId != null, ct);
        var earned = finished && answered;

        // A gift survey the owner sent to themselves gives nothing: see BroadcastCampaign.IsGiftSurveyTrial.
        if (earned && offered && !trial && delivery.GiftGrantedAtUtc == null && !user.IsLifetime)
        {
            await GiveGiftAsync(delivery.Id, userId, campaign, now, ct);
            // Whether this call gave it or a parallel one did — say what is written down.
            delivery = await db.BroadcastDeliveries.AsNoTracking().FirstAsync(d => d.Id == delivery.Id, ct);
            user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        }

        if (delivery.GiftGrantedAtUtc is { } grantedAt && delivery.GiftAccessUntilUtc is { } until)
        {
            // Days counted from the moment of the gift mean there was no access to add them to; a later
            // end means they went on top of a subscription or of free access that was running.
            if (until - grantedAt <= TimeSpan.FromDays(days) + TimeSpan.FromMinutes(1))
                return new SurveyGiftState(SurveyGiftOutcome.Given, days, until);
            // The end as it is now: the person may have bought or earned more since.
            return user.IsPro
                ? new SurveyGiftState(SurveyGiftOutcome.AddedToSubscription, days, user.HasActivePro(now) ? user.SubscribedUntil : until)
                : new SurveyGiftState(SurveyGiftOutcome.AddedToFreeAccess, days, user.HasActiveTrial(now) ? user.TrialEndsAtUtc : until);
        }
        if (user.IsLifetime) return new SurveyGiftState(SurveyGiftOutcome.Lifetime, days, null, trial);
        if (!offered) return new SurveyGiftState(SurveyGiftOutcome.OfferEnded, days, campaign.GiftOfferEndsAtUtc, trial);
        if (!finished) return new SurveyGiftState(SurveyGiftOutcome.Promised, days, null, trial);
        if (!answered) return new SurveyGiftState(SurveyGiftOutcome.NeedsAnswer, days, null, trial);
        if (trial)
        {
            // Nothing is given on a trial; the screen is the one a recipient with this access would see.
            // `user` is not tracked, so trying the gift on it changes nothing.
            var would = user.HasActivePro(now) ? SurveyGiftOutcome.AddedToSubscription
                : user.HasActiveTrial(now) ? SurveyGiftOutcome.AddedToFreeAccess
                : SurveyGiftOutcome.Given;
            return new SurveyGiftState(would, days, user.ExtendAccessDays(days, now), Trial: true);
        }
        return new SurveyGiftState(SurveyGiftOutcome.NotGiven, days, null);
    }

    /// <summary>
    /// Gives the campaign's gift to one recipient. The mark on the delivery row and the change of the
    /// user's access are one transaction, and the mark is an atomic claim: of several parallel calls
    /// exactly one changes the user. Nothing is marked when nothing was changed (an ordinary campaign:
    /// the person already has that much access, so the offer stays open for them until its deadline;
    /// a survey: lifetime access).
    /// </summary>
    private async Task<CampaignGift?> GiveGiftAsync(
        Guid deliveryId, Guid userId, BroadcastCampaign campaign, DateTime now, CancellationToken ct)
    {
        await using var transaction = await db.BeginTransactionAsync(ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return null;
        await db.Entry(user).ReloadAsync(ct);

        // An ordinary campaign gives "days from now" and nothing to someone who already has as much;
        // a survey's gift is added to the end of the access the person has.
        var until = campaign.IsGiftSurvey
            ? user.ExtendAccessDays(campaign.GiftDays, now)
            : user.GiftAccessDays(campaign.GiftDays, now);
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
    /// <param name="lastActive">When each person last did something (<see cref="LoadLastActivityAsync"/>);
    /// needed only for the audiences by activity.</param>
    public static bool IsIn(
        User user, BroadcastAudience audience, DateTime now, long ownerTelegramId,
        IReadOnlyDictionary<Guid, DateTime>? lastActive = null) => audience switch
    {
        BroadcastAudience.ActiveLately => LastActive(user, lastActive) > now.AddDays(-ActivityWindowDays),
        BroadcastAudience.InactiveLong => LastActive(user, lastActive) <= now.AddDays(-ActivityWindowDays),
        BroadcastAudience.AccessEnded => !user.IsPro && !user.HasActiveTrial(now),
        BroadcastAudience.OnTrial => user.HasActiveTrial(now),
        BroadcastAudience.Paying => user.HasActivePro(now),
        BroadcastAudience.ProLapsed => user.HasExpiredPro(now),
        BroadcastAudience.Owner => user.TelegramId == ownerTelegramId,
        _ => false
    };

    private static DateTime LastActive(User user, IReadOnlyDictionary<Guid, DateTime>? lastActive) =>
        lastActive != null && lastActive.TryGetValue(user.Id, out var at) && at > user.RegisteredAtUtc ? at : user.RegisteredAtUtc;

    private Task<Dictionary<Guid, DateTime>> LoadLastActivityAsync(CancellationToken ct) => UserActivity.LoadLastAsync(db, ct);

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
    /// <summary>The form of a survey (checked by <see cref="SurveyFormRules"/>); null — an ordinary campaign.
    /// A survey's message is made from the form — <see cref="Message"/> is not used.</summary>
    public SurveyForm? Survey { get; init; }
    /// <summary>The campaign exists for another audience and this part is meant for one more: people already
    /// in the campaign are skipped as always, so the message and the gift still reach a person once.</summary>
    public bool AnotherAudience { get; init; }
    /// <summary>Refuse when a campaign with this key already exists (see <see cref="BroadcastCampaignService.PrepareNewSurveyAsync"/>).</summary>
    public bool MustBeNew { get; init; }
}

/// <summary>A gift of access given by a campaign: how many days and until when the person now has access.</summary>
public record CampaignGift(int Days, DateTime AccessUntilUtc);

/// <summary>Where one recipient stands with the gift of a survey — for the form's line about the gift and its last screen.</summary>
/// <param name="Days">How many days the survey gives.</param>
/// <param name="UntilUtc">Given — until when the person has access now; the offer ended — when it ended; null otherwise.</param>
/// <param name="Trial">The owner's trial of the survey: nothing was given, this is what a person with
/// the owner's access would see.</param>
public record SurveyGiftState(SurveyGiftOutcome Outcome, int Days, DateTime? UntilUtc, bool Trial = false);

public enum SurveyGiftOutcome
{
    /// <summary>Not given yet: it will be when the person reaches the end having answered something.</summary>
    Promised,
    /// <summary>The person reached the end without answering anything: one answer, and the gift is theirs.</summary>
    NeedsAnswer,
    /// <summary>Given; there was no access: the days count from the moment of the gift.</summary>
    Given,
    /// <summary>Given: the days were added to the end of a running paid subscription.</summary>
    AddedToSubscription,
    /// <summary>Given: the days were added to the end of a running trial or bonus period.</summary>
    AddedToFreeAccess,
    /// <summary>Nothing to add, before or after the form: the access never ends.</summary>
    Lifetime,
    /// <summary>The form was first opened after the offer's deadline.</summary>
    OfferEnded,
    /// <summary>The gift should have been given and was not (a failed write) — the next finish gives it.</summary>
    NotGiven
}

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

/// <param name="Pending">Picked and not sent yet — above zero means the sending is unfinished.</param>
public record CampaignListItem(
    string Key, bool IsSurvey, string Message, BroadcastAudience Audience, DateTime CreatedAtUtc, string? ButtonText, int GiftDays,
    int Picked, int Pending, int Sent, int Opened, int Gifted);

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
    /// <summary>The survey's form; null for an ordinary campaign.</summary>
    public SurveyForm? Survey { get; init; }
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
    /// <param name="surveyOptions">Not null — a survey: the choices of its first question, each goes as its own answer button.</param>
    Task<CampaignSendAttempt> SendAsync(
        long telegramId, string text, string? buttonText, string? buttonQuery, string campaignKey,
        IReadOnlyList<string>? surveyOptions, CancellationToken ct);
}
