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
/// What people tell the owner, in one table: the answer to "Что смутило?" after a paywall closed
/// without a purchase, the answers to a survey broadcast (the first question by a button in the bot, the
/// rest in the mini-app's form), a free message from the mini-app.
///
/// Every write of one person goes under that person's lock (<see cref="ITraleDbContext.LockUserFeedbackAsync"/>),
/// so the limits here — the question once in <see cref="PaywallQuestionEveryDays"/> days, one survey
/// answer per question of a campaign, <see cref="MaxMessagesPerDay"/> messages a day — hold for parallel requests
/// and for two replicas, not only for a patient single user.
/// </summary>
public class UserFeedbackService(ITraleDbContext db, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<UserFeedbackService>();

    public const int MaxTextLength = 2000;
    public const int PaywallQuestionEveryDays = 30;
    public const int MaxMessagesPerDay = 5;

    /// <summary>
    /// Whether "Что смутило?" may be shown to this person now: not to someone with paid access
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
    /// A button under a survey broadcast was pressed: an answer to the form's first question.
    /// <paramref name="buttonIndex"/> counts the question's options, then "Другое".
    /// </summary>
    public async Task<BotSurveyAnswer> AnswerSurveyFromBotAsync(Guid userId, string? campaignKey, int buttonIndex, CancellationToken ct)
    {
        var survey = await FindSurveyAsync(userId, campaignKey, ct);
        var buttons = survey?.Form.BotButtons();
        if (survey == null || buttonIndex < 0 || buttonIndex >= buttons!.Count) return BotSurveyAnswer.Rejected;

        var first = survey.Form.Questions[0];
        var other = first.AllowOther && buttonIndex == first.Options.Count;
        var saved = await SaveSurveyAnswerAsync(
            userId, campaignKey, first.Id, new SurveyAnswerInput(other ? null : buttons[buttonIndex], other, null), keepOtherText: true, ct);
        return new BotSurveyAnswer(saved, buttons[buttonIndex], survey.Form.Questions.Count - 1);
    }

    /// <summary>
    /// The recipient opened the survey's form in the mini-app: the questions and what they have
    /// answered so far. The first open is recorded. Null for anyone but a recipient of the campaign.
    /// </summary>
    public async Task<SurveyState?> OpenSurveyAsync(Guid userId, string? campaignKey, CancellationToken ct)
    {
        var survey = await FindSurveyAsync(userId, campaignKey, ct);
        if (survey == null) return null;

        await db.MarkSurveyStepAsync(survey.DeliveryId, finished: false, DateTime.UtcNow, ct);

        var answers = await db.UserFeedback.AsNoTracking()
            .Where(f => f.UserId == userId && f.Kind == UserFeedbackKind.Survey && f.CampaignKey == survey.Key)
            .ToListAsync(ct);
        return new SurveyState(survey.Key, survey.Form, survey.Finished,
            answers.Where(a => a.QuestionId != null).ToDictionary(
                a => a.QuestionId!, a => new SurveyAnswerInput(a.Option == SurveyForm.OtherLabel ? null : a.Option, a.Option == SurveyForm.OtherLabel, a.Text)));
    }

    /// <summary>
    /// An answer to one question of a survey — saved page by page, so a form left halfway still
    /// gives its answers. Only a recipient of the campaign may answer. One row per person per
    /// question: answering again changes it. An empty answer is refused, not recorded — skipping a
    /// question is simply not answering it.
    /// </summary>
    public Task<SurveyAnswerOutcome> SaveSurveyAnswerAsync(
        Guid userId, string? campaignKey, string? questionId, SurveyAnswerInput answer, CancellationToken ct) =>
        SaveSurveyAnswerAsync(userId, campaignKey, questionId, answer, keepOtherText: false, ct);

    /// <param name="keepOtherText">"Другое" pressed in the bot carries no text: words written earlier stay.</param>
    private async Task<SurveyAnswerOutcome> SaveSurveyAnswerAsync(
        Guid userId, string? campaignKey, string? questionId, SurveyAnswerInput answer, bool keepOtherText, CancellationToken ct)
    {
        var survey = await FindSurveyAsync(userId, campaignKey, ct);
        var question = survey?.Form.Question(questionId);
        if (question == null) return SurveyAnswerOutcome.Rejected;

        var text = Clean(answer.Text);
        if (text is { Length: > MaxTextLength }) return SurveyAnswerOutcome.TooLong;
        string? option;
        if (question.Kind == SurveyQuestionKind.Text)
        {
            if (text == null) return SurveyAnswerOutcome.Empty;
            option = null;
        }
        else if (answer.Other)
        {
            if (!question.AllowOther) return SurveyAnswerOutcome.UnknownOption;
            option = SurveyForm.OtherLabel;
        }
        else
        {
            if (answer.Option == null || !question.Options.Contains(answer.Option)) return SurveyAnswerOutcome.UnknownOption;
            option = answer.Option;
            text = null;
        }

        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockUserFeedbackAsync(userId, ct);

        var now = DateTime.UtcNow;
        var row = await db.UserFeedback.FirstOrDefaultAsync(
            f => f.UserId == userId && f.Kind == UserFeedbackKind.Survey && f.CampaignKey == survey!.Key && f.QuestionId == question.Id, ct);
        SurveyAnswerOutcome outcome;
        if (row == null)
        {
            db.UserFeedback.Add(new UserFeedback
            {
                Id = Guid.NewGuid(), UserId = userId, Kind = UserFeedbackKind.Survey, CampaignKey = survey!.Key,
                QuestionId = question.Id, Option = option, Text = text, CreatedAtUtc = now
            });
            outcome = SurveyAnswerOutcome.Recorded;
        }
        else
        {
            if (keepOtherText && row.Option == option) text = row.Text;
            if (row.Option == option && row.Text == text)
            {
                outcome = SurveyAnswerOutcome.Same;
            }
            else
            {
                row.Option = option;
                row.Text = text;
                row.UpdatedAtUtc = now;
                outcome = SurveyAnswerOutcome.Changed;
            }
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        _logger.LogInformation("Survey {Key}: answer of {User} to {Question} — {Outcome}", survey!.Key, userId, question.Id, outcome);
        return outcome;
    }

    /// <summary>The recipient reached the last page of the form. Recorded once; false for anyone but a recipient.</summary>
    public async Task<bool> FinishSurveyAsync(Guid userId, string? campaignKey, CancellationToken ct)
    {
        var survey = await FindSurveyAsync(userId, campaignKey, ct);
        if (survey == null) return false;

        await db.MarkSurveyStepAsync(survey.DeliveryId, finished: true, DateTime.UtcNow, ct);
        return true;
    }

    private record RecipientSurvey(string Key, SurveyForm Form, Guid DeliveryId, bool Finished);

    /// <summary>The survey the person was sent; null when there is no such survey or they are not its
    /// recipient (a forwarded message or a guessed link gives nothing).</summary>
    private async Task<RecipientSurvey?> FindSurveyAsync(Guid userId, string? campaignKey, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(campaignKey)) return null;
        var campaign = await db.BroadcastCampaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Key == campaignKey, ct);
        var form = campaign?.Survey;
        if (form == null) return null;

        // Sending = the send did not report back; an answer proves the message arrived.
        var delivery = await db.BroadcastDeliveries.AsNoTracking()
            .Where(d => d.CampaignId == campaign!.Id && d.UserId == userId
                        && (d.Status == BroadcastDeliveryStatus.Sent || d.Status == BroadcastDeliveryStatus.Sending))
            .Select(d => new { d.Id, Finished = d.SurveyFinishedAtUtc != null })
            .FirstOrDefaultAsync(ct);
        return delivery == null ? null : new RecipientSurvey(campaign!.Key, form, delivery.Id, delivery.Finished);
    }

    /// <summary>
    /// Owner's view. <c>Recent</c> — the latest answers that say something (an option or a text),
    /// narrowed to one kind and / or one survey campaign when asked. The counts are always whole:
    /// the paywall question per option, how many free messages there are, and every survey sent to
    /// people (a survey the owner sent only to themselves as a trial is not listed), newest first.
    /// </summary>
    public async Task<FeedbackOverview> GetOverviewAsync(
        int take, UserFeedbackKind? kind, string? campaignKey, CancellationToken ct)
    {
        take = Math.Clamp(take, 1, 200);
        var said = db.UserFeedback.AsNoTracking().Where(f => f.Option != null || f.Text != null);
        if (kind != null) said = said.Where(f => f.Kind == kind);
        if (!string.IsNullOrWhiteSpace(campaignKey)) said = said.Where(f => f.CampaignKey == campaignKey);
        var recent = await said
            .OrderByDescending(f => f.UpdatedAtUtc ?? f.CreatedAtUtc)
            .Take(take)
            .Join(db.Users, f => f.UserId, u => u.Id, (f, u) => new FeedbackItem(
                f.Id, f.Kind, f.CampaignKey, f.QuestionId, f.Option, f.Text, f.UpdatedAtUtc ?? f.CreatedAtUtc, u.TelegramId))
            .ToListAsync(ct);

        var paywall = await db.UserFeedback.AsNoTracking()
            .Where(f => f.Kind == UserFeedbackKind.PaywallDecline)
            .GroupBy(f => f.Option)
            .Select(g => new { Option = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var messages = await db.UserFeedback.AsNoTracking().CountAsync(f => f.Kind == UserFeedbackKind.Message, ct);

        var campaigns = await db.BroadcastCampaigns.AsNoTracking()
            .Where(c => c.SurveyJson != null && c.Audience != BroadcastAudience.Owner)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(ct);
        var surveys = new List<SurveySummary>();
        foreach (var campaign in campaigns) surveys.Add(await SummarizeAsync(campaign, ct));

        return new FeedbackOverview(
            recent.OrderByDescending(r => r.AtUtc).ToList(),
            paywall.Sum(c => c.Count),
            PaywallDeclineOptions.All
                .Select(o => new OptionCount(o, paywall.Where(c => c.Option == o).Sum(c => c.Count))).ToList(),
            messages,
            surveys);
    }

    private async Task<SurveySummary> SummarizeAsync(BroadcastCampaign campaign, CancellationToken ct)
    {
        var form = campaign.Survey!;
        var deliveries = await db.BroadcastDeliveries.AsNoTracking()
            .Where(d => d.CampaignId == campaign.Id)
            .GroupBy(d => 1)
            .Select(g => new
            {
                Picked = g.Count(),
                Pending = g.Count(d => d.Status == BroadcastDeliveryStatus.Pending),
                Sent = g.Count(d => d.Status == BroadcastDeliveryStatus.Sent),
                Opened = g.Count(d => d.SurveyOpenedAtUtc != null),
                Finished = g.Count(d => d.SurveyFinishedAtUtc != null)
            })
            .FirstOrDefaultAsync(ct);
        var firstId = form.Questions[0].Id;
        var answeredFirst = await db.UserFeedback.AsNoTracking().CountAsync(
            f => f.Kind == UserFeedbackKind.Survey && f.CampaignKey == campaign.Key && f.QuestionId == firstId, ct);
        return new SurveySummary(
            campaign.Key, form.Questions[0].Text, form.Questions.Count, campaign.CreatedAtUtc, campaign.Audience,
            deliveries?.Picked ?? 0, deliveries?.Pending ?? 0,
            new SurveyFunnel(deliveries?.Sent ?? 0, answeredFirst, deliveries?.Opened ?? 0, deliveries?.Finished ?? 0));
    }

    /// <summary>
    /// One survey for the owner: the funnel, and per question — how many chose each option and what
    /// was written. With <paramref name="segment"/> the questions count only the people who chose
    /// that option of the first question ("what do those who would be very disappointed say");
    /// the funnel stays whole. Null when there is no such survey.
    /// </summary>
    public async Task<SurveyResults?> GetSurveyResultsAsync(string key, string? segment, CancellationToken ct)
    {
        var campaign = await db.BroadcastCampaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Key == key, ct);
        var form = campaign?.Survey;
        if (form == null) return null;

        var first = form.Questions[0];
        segment = first.Choices().Contains(segment ?? "") ? segment : null;
        var rows = db.UserFeedback.AsNoTracking().Where(f => f.Kind == UserFeedbackKind.Survey && f.CampaignKey == key);
        var answers = await (segment == null
                ? rows
                : rows.Where(f => rows.Any(a => a.UserId == f.UserId && a.QuestionId == first.Id && a.Option == segment)))
            .Join(db.Users, f => f.UserId, u => u.Id, (f, u) => new FeedbackItem(
                f.Id, f.Kind, f.CampaignKey, f.QuestionId, f.Option, f.Text, f.UpdatedAtUtc ?? f.CreatedAtUtc, u.TelegramId))
            .ToListAsync(ct);
        var written = await db.UserFeedback.AsNoTracking()
            .Where(f => f.Kind == UserFeedbackKind.Message && f.CampaignKey == key)
            .Join(db.Users, f => f.UserId, u => u.Id, (f, u) => new FeedbackItem(
                f.Id, f.Kind, f.CampaignKey, f.QuestionId, f.Option, f.Text, f.UpdatedAtUtc ?? f.CreatedAtUtc, u.TelegramId))
            .ToListAsync(ct);

        var questions = form.Questions.Select(q =>
        {
            var own = answers.Where(a => a.QuestionId == q.Id).ToList();
            var options = q.Choices().Select(o => new OptionCount(o, own.Count(a => a.Option == o))).ToList();
            return new SurveyQuestionResults(
                q.Id, q.Text, q.Kind, own.Count, options, Headline(q, options),
                own.Where(a => a.Text != null).OrderByDescending(a => a.AtUtc).Take(200).ToList());
        }).ToList();

        return new SurveyResults(
            await SummarizeAsync(campaign!, ct), segment, questions, written.OrderByDescending(w => w.AtUtc).Take(200).ToList());
    }

    /// <summary>The share of the question's headline option among those who answered, without those who
    /// chose the option it does not count. Null when the question has no such number or nobody is left to count.</summary>
    private static SurveyHeadline? Headline(SurveyQuestion question, IReadOnlyList<OptionCount> options)
    {
        var option = question.OptionByKey(question.HeadlineOption);
        if (option == null) return null;
        var without = question.OptionByKey(question.HeadlineWithout);
        var counted = options.Where(o => o.Option != without).Sum(o => o.Count);
        var chose = options.First(o => o.Option == option).Count;
        return new SurveyHeadline(option, without, chose, counted);
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
    /// <summary>Not a survey, not its recipient, or no such question — nothing is written.</summary>
    Rejected,
    /// <summary>The person's first answer to this question.</summary>
    Recorded,
    Changed,
    /// <summary>The same answer again.</summary>
    Same,
    /// <summary>No such option in the question — nothing is written.</summary>
    UnknownOption,
    TooLong,
    /// <summary>A free-text question answered with nothing — nothing is written.</summary>
    Empty
}

/// <summary>An answer to one question. <paramref name="Other"/> — "Другое": the person's own words are in
/// <paramref name="Text"/> (may be empty yet). For a free-text question only <paramref name="Text"/> matters.</summary>
public record SurveyAnswerInput(string? Option, bool Other, string? Text);

/// <param name="Button">The caption of the pressed button.</param>
/// <param name="MoreQuestions">How many questions of the form are left for the mini-app.</param>
public record BotSurveyAnswer(SurveyAnswerOutcome Outcome, string? Button, int MoreQuestions)
{
    public static readonly BotSurveyAnswer Rejected = new(SurveyAnswerOutcome.Rejected, null, 0);
}

/// <param name="Finished">The person has already gone through the form to the end.</param>
public record SurveyState(string Key, SurveyForm Form, bool Finished, IReadOnlyDictionary<string, SurveyAnswerInput> Answers);

public record OptionCount(string Option, int Count);

/// <summary>How far people got: delivered → answered the first question (in the bot or in the form) →
/// opened the form in the mini-app → reached its last page.</summary>
public record SurveyFunnel(int Sent, int AnsweredFirst, int OpenedForm, int Finished);

/// <param name="Title">The first question — what the owner knows the survey by.</param>
/// <param name="Picked">People picked as recipients so far.</param>
/// <param name="Pending">Of them, still waiting to be sent — above zero means the sending was left unfinished.</param>
public record SurveySummary(
    string Key, string Title, int Questions, DateTime CreatedAtUtc, BroadcastAudience Audience, int Picked, int Pending, SurveyFunnel Funnel);

/// <param name="Option">The headline option as it is worded in this survey.</param>
/// <param name="Chose">People who chose <paramref name="Option"/>.</param>
/// <param name="Of">People who answered the question, without those who chose <paramref name="Without"/>.</param>
public record SurveyHeadline(string Option, string? Without, int Chose, int Of);

/// <param name="Answered">People who answered the question (within the segment, when one is asked for).</param>
/// <param name="Texts">What was written: "Другое" with words, answers to a free-text question.</param>
public record SurveyQuestionResults(
    string Id, string Text, SurveyQuestionKind Kind, int Answered, IReadOnlyList<OptionCount> Options, SurveyHeadline? Headline,
    IReadOnlyList<FeedbackItem> Texts);

/// <param name="Segment">The option of the first question the questions are narrowed to; null — everyone.</param>
/// <param name="Written">Messages written by "Написать подробнее" from this survey.</param>
public record SurveyResults(
    SurveySummary Summary, string? Segment, IReadOnlyList<SurveyQuestionResults> Questions, IReadOnlyList<FeedbackItem> Written);

public record FeedbackItem(
    Guid Id, UserFeedbackKind Kind, string? CampaignKey, string? QuestionId, string? Option, string? Text, DateTime AtUtc, long TelegramId);

/// <param name="PaywallShown">How many times "Что смутило?" was shown, answered or not.</param>
public record FeedbackOverview(
    IReadOnlyList<FeedbackItem> Recent,
    int PaywallShown,
    IReadOnlyList<OptionCount> PaywallOptions,
    int Messages,
    IReadOnlyList<SurveySummary> Surveys);
