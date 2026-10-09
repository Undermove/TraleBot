namespace Domain.Entities;

/// <summary>
/// What the owner did about a person's feedback: an answer sent to them by the bot, or a mark that
/// their messages need no answer. Together with the person's texts in <see cref="UserFeedback"/>
/// these rows make one conversation per person.
/// </summary>
public class FeedbackReply
{
    public Guid Id { get; set; }

    /// <summary>The person the owner answers.</summary>
    public Guid UserId { get; set; }

    public FeedbackReplyKind Kind { get; set; }

    /// <summary>The answer; null for <see cref="FeedbackReplyKind.NoReplyNeeded"/>.</summary>
    public string? Text { get; set; }

    /// <summary>The person's words the answer quotes, as they were sent (shortened).</summary>
    public string? Quote { get; set; }

    public FeedbackReplyStatus Status { get; set; }

    /// <summary>Telegram's answer when the message was not delivered.</summary>
    public string? Error { get; set; }

    /// <summary>Made by the mini-app once per written answer: a second request with the same token
    /// (a double tap, a retry after a lost response) finds this row and sends nothing.</summary>
    public string? ClientToken { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}

public enum FeedbackReplyKind
{
    Reply = 0,
    /// <summary>"Не требует ответа": takes the person's messages out of the unanswered ones; nothing is sent.</summary>
    NoReplyNeeded = 1
}

public enum FeedbackReplyStatus
{
    /// <summary>Recorded, the send has not reported back. A row left here is never resent by itself.</summary>
    Sending = 0,
    Sent = 1,
    /// <summary>The person blocked the bot (403).</summary>
    Blocked = 2,
    /// <summary>Telegram refused the message; it was not delivered.</summary>
    Rejected = 3,
    /// <summary>No answer from Telegram: the message may or may not have arrived.</summary>
    Unknown = 4
}
