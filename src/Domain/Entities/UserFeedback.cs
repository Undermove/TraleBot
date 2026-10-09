namespace Domain.Entities;

/// <summary>
/// What a person told the owner: why they closed the paywall without paying, which button of a
/// survey broadcast they pressed, or a free message from the mini-app. One table for all three, so
/// a single read-only query shows everything (<c>scripts/sql/feedback-report.sql</c>).
/// </summary>
public class UserFeedback
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public UserFeedbackKind Kind { get; set; }

    /// <summary>Key of the broadcast campaign the answer belongs to: always for
    /// <see cref="UserFeedbackKind.Survey"/>, for <see cref="UserFeedbackKind.Message"/> — when the
    /// person came by "Написать подробнее" under a survey.</summary>
    public string? CampaignKey { get; set; }

    /// <summary>For <see cref="UserFeedbackKind.Survey"/>: which question of the campaign's form the row answers
    /// (<see cref="SurveyQuestion.Id"/>).</summary>
    public string? QuestionId { get; set; }

    /// <summary>The chosen option: a code from <see cref="PaywallDeclineOptions"/> for the paywall
    /// question; for a survey — the text of the chosen option, or <see cref="SurveyForm.OtherLabel"/>
    /// when the person answered in their own words (then <see cref="Text"/> holds them). Null for a
    /// paywall question that was shown and closed without an answer, for an answer to a free-text
    /// question and for a free message.</summary>
    public string? Option { get; set; }

    /// <summary>What the person wrote in their own words.</summary>
    public string? Text { get; set; }

    /// <summary>For the paywall question — when it was shown; otherwise when the answer came.</summary>
    public DateTime CreatedAtUtc { get; set; }

    /// <summary>When the answer was given to a question shown earlier, or changed.</summary>
    public DateTime? UpdatedAtUtc { get; set; }
}

public enum UserFeedbackKind
{
    /// <summary>"Что смутило?" after the paywall was closed without a purchase. The row appears
    /// when the question is shown — this is what limits it to once in 30 days.</summary>
    PaywallDecline = 0,
    /// <summary>An answer to one question of a survey broadcast. One row per person per question.</summary>
    Survey = 1,
    /// <summary>Free text from the "Написать автору" screen of the mini-app.</summary>
    Message = 2
}

/// <summary>Answers to "Что смутило?" — stored as codes, shown in Russian by the mini-app.</summary>
public static class PaywallDeclineOptions
{
    public const string Expensive = "expensive";
    public const string NotNow = "not_now";
    public const string Unclear = "unclear";
    public const string Other = "other";

    public static readonly IReadOnlyList<string> All = [Expensive, NotNow, Unclear, Other];
}
