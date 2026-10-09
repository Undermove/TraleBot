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

namespace Application.Feedback;

/// <summary>
/// Conversations with the people who wrote something: a letter to the author, their own words in a
/// survey, a comment at the paywall. One conversation per person — their texts
/// (<see cref="UserFeedback"/>) and what the owner did about them (<see cref="FeedbackReply"/>),
/// in the order they happened. The owner answers from the admin; the answer goes out as a message
/// of the bot. Nothing here is sent by itself: only <see cref="ReplyAsync"/>, called for one person.
/// </summary>
public class FeedbackReplyService(ITraleDbContext db, IFeedbackReplySender sender, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<FeedbackReplyService>();

    /// <summary>Telegram takes 4096 characters; the quote and the signature need their room.</summary>
    public const int MaxReplyLength = 3500;
    public const int MaxQuoteLength = 200;
    /// <summary>How the owner signs an answer.</summary>
    public const string Signature = "Дима, автор TraleBot";

    /// <summary>Everyone who wrote something, the ones waiting for an answer first, then the latest.</summary>
    public async Task<IReadOnlyList<FeedbackThreadSummary>> ListThreadsAsync(bool unansweredOnly, CancellationToken ct)
    {
        var texts = await db.UserFeedback.AsNoTracking()
            .Where(f => f.Text != null)
            .Select(f => new { f.UserId, f.Kind, f.Text, At = f.UpdatedAtUtc ?? f.CreatedAtUtc })
            .ToListAsync(ct);
        var acts = await db.FeedbackReplies.AsNoTracking()
            .Select(r => new { r.UserId, r.Kind, r.CreatedAtUtc, r.Text })
            .ToListAsync(ct);
        // Also the people the owner wrote to first: the conversation exists from the owner's first message.
        var userIds = texts.Select(t => t.UserId)
            .Concat(acts.Where(a => a.Kind == FeedbackReplyKind.Reply).Select(a => a.UserId)).Distinct().ToList();
        var telegramIds = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.TelegramId, ct);
        var textsByUser = texts.ToLookup(t => t.UserId);
        var actsByUser = acts.ToLookup(a => a.UserId);

        return userIds
            .Where(telegramIds.ContainsKey)
            .Select(id =>
            {
                var theirs = textsByUser[id].ToList();
                var own = actsByUser[id].ToList();
                var last = theirs.MaxBy(t => t.At);
                var lastReply = own.Where(a => a.Kind == FeedbackReplyKind.Reply).MaxBy(a => a.CreatedAtUtc);
                // What the list shows is whatever was said last — by the person or by the owner.
                var ownerLast = lastReply != null && (last == null || lastReply.CreatedAtUtc >= last.At);
                return new FeedbackThreadSummary(
                    telegramIds[id], last?.Kind ?? UserFeedbackKind.Message,
                    ownerLast ? lastReply!.Text! : last!.Text!, ownerLast ? lastReply!.CreatedAtUtc : last!.At, theirs.Count,
                    last == null ? FeedbackThreadStatus.Answered : StatusOf(last.At, own.Select(a => (a.Kind, a.CreatedAtUtc))),
                    ownerLast);
            })
            .Where(t => !unansweredOnly || t.Status.IsUnanswered())
            .OrderByDescending(t => t.Status.IsUnanswered()).ThenByDescending(t => t.LastAtUtc)
            .ToList();
    }

    /// <summary>How many people wait for an answer — for the badge in the admin.</summary>
    public async Task<int> CountUnansweredAsync(CancellationToken ct) =>
        (await ListThreadsAsync(unansweredOnly: true, ct)).Count;

    /// <summary>One person's conversation, oldest first; null when there is no such person.</summary>
    public async Task<FeedbackThread?> GetThreadAsync(long telegramId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.TelegramId == telegramId, ct);
        return user == null ? null : await LoadThreadAsync(user, ct);
    }

    /// <summary>The person's own view of the conversation: their texts and the answers that reached them.</summary>
    public async Task<IReadOnlyList<FeedbackThreadItem>> GetOwnThreadAsync(Guid userId, int take, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return [];
        var thread = await LoadThreadAsync(user, ct);
        if (!thread.Items.Any(i => i.FromOwner && i.Delivery == FeedbackReplyStatus.Sent)) return [];
        return thread.Items.Where(i => !i.FromOwner || i.Delivery == FeedbackReplyStatus.Sent).TakeLast(Math.Clamp(take, 1, 50)).ToList();
    }

    private async Task<FeedbackThread> LoadThreadAsync(User user, CancellationToken ct)
    {
        var texts = await db.UserFeedback.AsNoTracking()
            .Where(f => f.UserId == user.Id && f.Text != null)
            .ToListAsync(ct);
        var acts = await db.FeedbackReplies.AsNoTracking().Where(r => r.UserId == user.Id).ToListAsync(ct);

        var keys = texts.Where(t => t.CampaignKey != null).Select(t => t.CampaignKey!).Distinct().ToList();
        var surveys = (await db.BroadcastCampaigns.AsNoTracking().Where(c => keys.Contains(c.Key)).ToListAsync(ct))
            .ToDictionary(c => c.Key, c => c.Survey);

        var items = texts.Select(t =>
            {
                surveys.TryGetValue(t.CampaignKey ?? "", out var survey);
                // A letter written by "Написать подробнее" belongs to the survey's first question; an answer — to its own.
                var question = t.Kind == UserFeedbackKind.Survey ? survey?.Question(t.QuestionId)?.Text : survey?.Questions[0].Text;
                return new FeedbackThreadItem(t.Id, false, t.Text!, t.UpdatedAtUtc ?? t.CreatedAtUtc, t.Kind, question, t.Option, null, null);
            })
            .Concat(acts.Where(a => a.Kind == FeedbackReplyKind.Reply).Select(a =>
                new FeedbackThreadItem(a.Id, true, a.Text!, a.CreatedAtUtc, null, null, null, a.Status, a.Quote)))
            .OrderBy(i => i.AtUtc)
            .ToList();

        var lastText = texts.Count == 0 ? (DateTime?)null : texts.Max(t => t.UpdatedAtUtc ?? t.CreatedAtUtc);
        var status = lastText == null ? FeedbackThreadStatus.Answered : StatusOf(lastText.Value, acts.Select(a => (a.Kind, a.CreatedAtUtc)));
        return new FeedbackThread(user.TelegramId, user.IsActive, status, items);
    }

    /// <summary>New — the person wrote and nothing was done; Replied back — they wrote again after an
    /// answer; otherwise the owner had the last word (an answer or "no answer needed").</summary>
    private static FeedbackThreadStatus StatusOf(DateTime lastTextAt, IEnumerable<(FeedbackReplyKind Kind, DateTime At)> acts)
    {
        var done = acts.ToList();
        if (done.Any(a => a.At >= lastTextAt))
            return done.MaxBy(a => a.At).Kind == FeedbackReplyKind.NoReplyNeeded ? FeedbackThreadStatus.Closed : FeedbackThreadStatus.Answered;
        return done.Any(a => a.Kind == FeedbackReplyKind.Reply) ? FeedbackThreadStatus.RepliedBack : FeedbackThreadStatus.New;
    }

    /// <summary>
    /// Sends the owner's answer to one person by the bot and records it with what Telegram said.
    /// <paramref name="clientToken"/> makes it happen once: the row is written before the send
    /// under a unique token, so a double tap or a retried request finds it and sends nothing.
    /// A person who blocked the bot is flagged unreachable, the way a broadcast does it.
    /// </summary>
    public async Task<FeedbackReplyResult> ReplyAsync(long telegramId, string? text, Guid? quoteId, string? clientToken, CancellationToken ct)
    {
        text = string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        clientToken = string.IsNullOrWhiteSpace(clientToken) ? null : clientToken.Trim();
        if (text == null) return FeedbackReplyResult.Refused(FeedbackReplyOutcome.Empty);
        if (text.Length > MaxReplyLength) return FeedbackReplyResult.Refused(FeedbackReplyOutcome.TooLong);
        if (clientToken is null or { Length: > 64 }) return FeedbackReplyResult.Refused(FeedbackReplyOutcome.NoToken);

        var user = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == telegramId, ct);
        if (user == null) return FeedbackReplyResult.Refused(FeedbackReplyOutcome.NoSuchPerson);

        // What is quoted: the text the owner answered to, or the person's latest one.
        var written = db.UserFeedback.AsNoTracking().Where(f => f.UserId == user.Id && f.Text != null);
        var quoted = quoteId == null
            ? await written.OrderByDescending(f => f.UpdatedAtUtc ?? f.CreatedAtUtc).FirstOrDefaultAsync(ct)
            : await written.FirstOrDefaultAsync(f => f.Id == quoteId, ct);
        // A text was named and it is not this person's — refuse; no text at all — the owner writes first, without a quote.
        if (quoted == null && quoteId != null) return FeedbackReplyResult.Refused(FeedbackReplyOutcome.NothingToAnswer);

        var reply = new FeedbackReply
        {
            Id = Guid.NewGuid(), UserId = user.Id, Kind = FeedbackReplyKind.Reply, Text = text, Quote = quoted == null ? null : Shorten(quoted.Text!),
            Status = FeedbackReplyStatus.Sending, ClientToken = clientToken, CreatedAtUtc = DateTime.UtcNow
        };
        db.FeedbackReplies.Add(reply);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // The same answer is already on its way or sent — the unique token let one request through.
            db.Entry(reply).State = EntityState.Detached;
            var first = await db.FeedbackReplies.AsNoTracking().FirstOrDefaultAsync(r => r.ClientToken == clientToken, ct);
            if (first == null) throw;
            return new FeedbackReplyResult(FeedbackReplyOutcome.AlreadySent, first.Status);
        }

        // The answer is recorded — from here the request being dropped must not lose what Telegram says.
        var attempt = await sender.SendAsync(user.TelegramId, MessageText(reply.Quote, text), CancellationToken.None);
        reply.Status = attempt.Outcome switch
        {
            CampaignSendOutcome.Sent => FeedbackReplyStatus.Sent,
            CampaignSendOutcome.Blocked => FeedbackReplyStatus.Blocked,
            CampaignSendOutcome.Unknown => FeedbackReplyStatus.Unknown,
            _ => FeedbackReplyStatus.Rejected
        };
        reply.Error = attempt.Error is { Length: > 500 } ? attempt.Error[..500] : attempt.Error;
        // Same as a broadcast: a blocked bot means the person is unreachable.
        if (attempt.Outcome == CampaignSendOutcome.Blocked) user.IsActive = false;
        await db.SaveChangesAsync(CancellationToken.None);

        _logger.LogInformation("Feedback reply to {TelegramId}: {Status}", telegramId, reply.Status);
        return new FeedbackReplyResult(FeedbackReplyOutcome.Done, reply.Status);
    }

    /// <summary>"Не требует ответа": the person's messages so far leave the unanswered ones; nothing is sent.</summary>
    public async Task<bool> MarkNoReplyNeededAsync(long telegramId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.TelegramId == telegramId, ct);
        if (user == null) return false;
        db.FeedbackReplies.Add(new FeedbackReply
        {
            Id = Guid.NewGuid(), UserId = user.Id, Kind = FeedbackReplyKind.NoReplyNeeded,
            Status = FeedbackReplyStatus.Sent, CreatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>What the person receives: their own words, shortened, then the answer signed by the author.</summary>
    public static string MessageText(string? quote, string text) =>
        quote == null ? $"{Signature}: {text}" : $"Твоё сообщение: «{quote}»\n\n{Signature}: {text}";

    private static string Shorten(string text)
    {
        var oneLine = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return oneLine.Length <= MaxQuoteLength ? oneLine : oneLine[..(MaxQuoteLength - 1)].TrimEnd() + "…";
    }
}

public enum FeedbackThreadStatus
{
    /// <summary>The person wrote, nothing has been done about it.</summary>
    New,
    /// <summary>The owner had the last word.</summary>
    Answered,
    /// <summary>The person wrote again after an answer.</summary>
    RepliedBack,
    /// <summary>Marked as needing no answer.</summary>
    Closed
}

public static class FeedbackThreadStatusExtensions
{
    public static bool IsUnanswered(this FeedbackThreadStatus status) =>
        status is FeedbackThreadStatus.New or FeedbackThreadStatus.RepliedBack;
}

/// <param name="LastKind">Where the person's latest text came from.</param>
/// <param name="LastText">What was said last in the conversation.</param>
/// <param name="LastFromOwner">The last word is the owner's — <paramref name="LastText"/> is their answer.</param>
public record FeedbackThreadSummary(
    long TelegramId, UserFeedbackKind LastKind, string LastText, DateTime LastAtUtc, int Texts, FeedbackThreadStatus Status,
    bool LastFromOwner);

/// <param name="Kind">For the person's text — where it came from; null for the owner's answer.</param>
/// <param name="Question">The survey question the text answers or was written after.</param>
/// <param name="Delivery">For the owner's answer — what Telegram said.</param>
public record FeedbackThreadItem(
    Guid Id, bool FromOwner, string Text, DateTime AtUtc, UserFeedbackKind? Kind, string? Question, string? Option,
    FeedbackReplyStatus? Delivery, string? Quote);

/// <param name="Reachable">False — the person blocked the bot; an answer will not reach them.</param>
public record FeedbackThread(long TelegramId, bool Reachable, FeedbackThreadStatus Status, IReadOnlyList<FeedbackThreadItem> Items);

public enum FeedbackReplyOutcome
{
    /// <summary>Recorded and handed to Telegram — see the status for what it said.</summary>
    Done,
    /// <summary>A request with this token was already handled; nothing was sent again.</summary>
    AlreadySent,
    Empty,
    TooLong,
    NoToken,
    NoSuchPerson,
    /// <summary>The text to answer was named, and it is not this person's.</summary>
    NothingToAnswer
}

public record FeedbackReplyResult(FeedbackReplyOutcome Outcome, FeedbackReplyStatus? Status)
{
    public static FeedbackReplyResult Refused(FeedbackReplyOutcome outcome) => new(outcome, null);
}

/// <summary>Sends the owner's answer to one person and says what Telegram answered. Never throws.</summary>
public interface IFeedbackReplySender
{
    Task<CampaignSendAttempt> SendAsync(long telegramId, string text, CancellationToken ct);
}
