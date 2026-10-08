using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Feedback;

/// <summary>
/// What people tell the owner, in one table: the answer to "Что остановило?" after a paywall closed
/// without a purchase, the button pressed under a survey broadcast, a free message from the mini-app.
///
/// Every write of one person goes under that person's lock (<see cref="ITraleDbContext.LockUserFeedbackAsync"/>),
/// so the limits here — the question once in <see cref="PaywallQuestionEveryDays"/> days, one survey
/// answer per campaign, <see cref="MaxMessagesPerDay"/> messages a day — hold for parallel requests
/// and for two replicas, not only for a patient single user.
/// </summary>
public class UserFeedbackService(ITraleDbContext db, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<UserFeedbackService>();

    public const int MaxTextLength = 2000;
    public const int PaywallQuestionEveryDays = 30;
    public const int MaxMessagesPerDay = 5;

    /// <summary>
    /// Whether "Что остановило?" may be shown to this person now: not to someone with paid access
    /// and not more often than once in <see cref="PaywallQuestionEveryDays"/> days. Read-only — the
    /// mini-app asks this when the paywall opens, so that closing it is not held up by a request
    /// when there is nothing to ask.
    /// </summary>
    public async Task<bool> IsPaywallQuestionDueAsync(Guid userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null || user.HasActivePro(now)) return false;

        var cutoff = now.AddDays(-PaywallQuestionEveryDays);
        return !await db.UserFeedback.AnyAsync(
            f => f.UserId == userId && f.Kind == UserFeedbackKind.PaywallDecline && f.CreatedAtUtc > cutoff, ct);
    }

    /// <summary>
    /// The person closed the paywall without buying. Returns the id of the question to show, or null
    /// when it is not due (<see cref="IsPaywallQuestionDueAsync"/>). The row is written here, at the
    /// show — a question closed without an answer counts as asked.
    /// </summary>
    public async Task<Guid?> OfferPaywallQuestionAsync(Guid userId, CancellationToken ct)
    {
        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockUserFeedbackAsync(userId, ct);
        if (!await IsPaywallQuestionDueAsync(userId, ct)) return null;

        var question = new UserFeedback
        {
            Id = Guid.NewGuid(), UserId = userId, Kind = UserFeedbackKind.PaywallDecline, CreatedAtUtc = DateTime.UtcNow
        };
        db.UserFeedback.Add(question);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return question.Id;
    }

    /// <summary>Records the answer to a question given out by <see cref="OfferPaywallQuestionAsync"/>.
    /// Answering again replaces the answer — there is still one row per shown question.</summary>
    public async Task<FeedbackOutcome> AnswerPaywallQuestionAsync(
        Guid userId, Guid questionId, string? option, string? text, CancellationToken ct)
    {
        if (option == null || !PaywallDeclineOptions.All.Contains(option)) return FeedbackOutcome.UnknownOption;
        text = Clean(text);
        if (text is { Length: > MaxTextLength }) return FeedbackOutcome.TooLong;

        var question = await db.UserFeedback.FirstOrDefaultAsync(
            f => f.Id == questionId && f.UserId == userId && f.Kind == UserFeedbackKind.PaywallDecline, ct);
        if (question == null) return FeedbackOutcome.NotFound;

        question.Option = option;
        question.Text = text;
        question.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return FeedbackOutcome.Saved;
    }

    /// <summary>A free message from the mini-app. <paramref name="campaignKey"/> — the survey the
    /// person came from by "Написать подробнее"; a key of no existing campaign is dropped.</summary>
    public async Task<FeedbackOutcome> LeaveMessageAsync(Guid userId, string? text, string? campaignKey, CancellationToken ct)
    {
        text = Clean(text);
        if (text == null) return FeedbackOutcome.Empty;
        if (text.Length > MaxTextLength) return FeedbackOutcome.TooLong;

        campaignKey = string.IsNullOrWhiteSpace(campaignKey) ? null : campaignKey.Trim();
        if (campaignKey != null && !await db.BroadcastCampaigns.AnyAsync(c => c.Key == campaignKey, ct)) campaignKey = null;

        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockUserFeedbackAsync(userId, ct);

        var now = DateTime.UtcNow;
        var dayAgo = now.AddDays(-1);
        var lately = await db.UserFeedback.CountAsync(
            f => f.UserId == userId && f.Kind == UserFeedbackKind.Message && f.CreatedAtUtc > dayAgo, ct);
        if (lately >= MaxMessagesPerDay) return FeedbackOutcome.TooOften;

        db.UserFeedback.Add(new UserFeedback
        {
            Id = Guid.NewGuid(), UserId = userId, Kind = UserFeedbackKind.Message,
            CampaignKey = campaignKey, Text = text, CreatedAtUtc = now
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return FeedbackOutcome.Saved;
    }

    /// <summary>
    /// A button under a survey broadcast was pressed. Only a recipient of the campaign counts (a
    /// forwarded message gives nothing). One row per person per campaign: the first press writes
    /// it, another button changes it.
    /// </summary>
    public async Task<SurveyAnswer> AnswerSurveyAsync(Guid userId, string? campaignKey, int optionIndex, CancellationToken ct)
    {
        var campaign = await db.BroadcastCampaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Key == campaignKey, ct);
        if (campaign?.SurveyOptions == null || optionIndex < 0 || optionIndex >= campaign.SurveyOptions.Length)
            return SurveyAnswer.Rejected;

        // Sending = the send did not report back; a press on the button proves the message arrived.
        var isRecipient = await db.BroadcastDeliveries.AnyAsync(
            d => d.CampaignId == campaign.Id && d.UserId == userId
                 && (d.Status == BroadcastDeliveryStatus.Sent || d.Status == BroadcastDeliveryStatus.Sending), ct);
        if (!isRecipient) return SurveyAnswer.Rejected;

        var option = campaign.SurveyOptions[optionIndex];
        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockUserFeedbackAsync(userId, ct);

        var now = DateTime.UtcNow;
        var answer = await db.UserFeedback.FirstOrDefaultAsync(
            f => f.UserId == userId && f.Kind == UserFeedbackKind.Survey && f.CampaignKey == campaign.Key, ct);
        SurveyAnswerOutcome outcome;
        if (answer == null)
        {
            db.UserFeedback.Add(new UserFeedback
            {
                Id = Guid.NewGuid(), UserId = userId, Kind = UserFeedbackKind.Survey,
                CampaignKey = campaign.Key, Option = option, CreatedAtUtc = now
            });
            outcome = SurveyAnswerOutcome.Recorded;
        }
        else if (answer.Option == option)
        {
            outcome = SurveyAnswerOutcome.Same;
        }
        else
        {
            answer.Option = option;
            answer.UpdatedAtUtc = now;
            outcome = SurveyAnswerOutcome.Changed;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        _logger.LogInformation("Survey {Key}: answer of {User} — {Outcome}", campaign.Key, userId, outcome);
        return new SurveyAnswer(outcome, option);
    }

    /// <summary>Owner's view: the latest answers that say something, and the counts per option.</summary>
    public async Task<FeedbackOverview> GetOverviewAsync(int take, CancellationToken ct)
    {
        take = Math.Clamp(take, 1, 200);
        var recent = await db.UserFeedback.AsNoTracking()
            .Where(f => f.Option != null || f.Text != null)
            .OrderByDescending(f => f.UpdatedAtUtc ?? f.CreatedAtUtc)
            .Take(take)
            .Join(db.Users, f => f.UserId, u => u.Id, (f, u) => new FeedbackItem(
                f.Kind, f.CampaignKey, f.Option, f.Text, f.UpdatedAtUtc ?? f.CreatedAtUtc, u.TelegramId))
            .ToListAsync(ct);

        var counts = await db.UserFeedback.AsNoTracking()
            .Where(f => f.Kind != UserFeedbackKind.Message)
            .GroupBy(f => new { f.Kind, f.CampaignKey, f.Option })
            .Select(g => new { g.Key.Kind, g.Key.CampaignKey, g.Key.Option, Count = g.Count() })
            .ToListAsync(ct);

        var paywall = counts.Where(c => c.Kind == UserFeedbackKind.PaywallDecline).ToList();
        var surveyKeys = counts.Where(c => c.Kind == UserFeedbackKind.Survey).Select(c => c.CampaignKey!).Distinct().ToList();
        var campaigns = await db.BroadcastCampaigns.AsNoTracking()
            .Where(c => surveyKeys.Contains(c.Key))
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(ct);

        return new FeedbackOverview(
            recent.OrderByDescending(r => r.AtUtc).ToList(),
            paywall.Sum(c => c.Count),
            PaywallDeclineOptions.All
                .Select(o => new OptionCount(o, paywall.Where(c => c.Option == o).Sum(c => c.Count))).ToList(),
            campaigns.Select(c => new SurveyCounts(c.Key, c.Message, (c.SurveyOptions ?? [])
                .Select(o => new OptionCount(o, counts.Where(x => x.Kind == UserFeedbackKind.Survey && x.CampaignKey == c.Key && x.Option == o).Sum(x => x.Count)))
                .ToList())).ToList());
    }

    private static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
}

public enum FeedbackOutcome
{
    Saved,
    Empty,
    TooLong,
    /// <summary>More than <see cref="UserFeedbackService.MaxMessagesPerDay"/> messages in the last day.</summary>
    TooOften,
    UnknownOption,
    NotFound
}

public enum SurveyAnswerOutcome
{
    /// <summary>Not a survey, not its recipient, or no such button — nothing is written.</summary>
    Rejected,
    /// <summary>The person's first answer in this campaign.</summary>
    Recorded,
    Changed,
    /// <summary>The same button again.</summary>
    Same
}

public record SurveyAnswer(SurveyAnswerOutcome Outcome, string? Option)
{
    public static readonly SurveyAnswer Rejected = new(SurveyAnswerOutcome.Rejected, null);
}

public record OptionCount(string Option, int Count);

public record SurveyCounts(string Key, string Question, IReadOnlyList<OptionCount> Options);

public record FeedbackItem(UserFeedbackKind Kind, string? CampaignKey, string? Option, string? Text, DateTime AtUtc, long TelegramId);

/// <param name="PaywallShown">How many times "Что остановило?" was shown, answered or not.</param>
public record FeedbackOverview(
    IReadOnlyList<FeedbackItem> Recent,
    int PaywallShown,
    IReadOnlyList<OptionCount> PaywallOptions,
    IReadOnlyList<SurveyCounts> Surveys);
