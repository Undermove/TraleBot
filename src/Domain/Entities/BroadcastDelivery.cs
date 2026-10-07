#pragma warning disable CS8618
namespace Domain.Entities;

/// <summary>
/// One recipient of one campaign. The unique (CampaignId, UserId) pair is what makes a campaign
/// idempotent: a user is picked once and the message leaves at most once.
/// </summary>
public class BroadcastDelivery
{
    public Guid Id { get; set; }
    public Guid CampaignId { get; set; }
    public Guid UserId { get; set; }
    public long TelegramId { get; set; }

    /// <summary>True for recipients picked as the random test sample.</summary>
    public bool IsSample { get; set; }

    public BroadcastDeliveryStatus Status { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    /// <summary>When Telegram accepted the message.</summary>
    public DateTime? SentAtUtc { get; set; }

    /// <summary>First time the user opened the mini-app by the campaign's button.</summary>
    public DateTime? OpenedAtUtc { get; set; }

    /// <summary>When the campaign's gift of access was given to this recipient — at most once.
    /// Null: no gift (the campaign has none, the offer ended, or the person already had as much access).</summary>
    public DateTime? GiftGrantedAtUtc { get; set; }

    /// <summary>Until when the gift gave access.</summary>
    public DateTime? GiftAccessUntilUtc { get; set; }

    /// <summary>Telegram's answer for Blocked / Rejected / Unknown.</summary>
    public string? Error { get; set; }
}

public enum BroadcastDeliveryStatus
{
    /// <summary>Picked, not sent yet.</summary>
    Pending = 0,
    /// <summary>Claimed by a send that has not reported back. A row left here (process died,
    /// network broke mid-request) is never retried automatically: the message may have left.</summary>
    Sending = 1,
    Sent = 2,
    /// <summary>The user blocked the bot (403).</summary>
    Blocked = 3,
    /// <summary>Telegram refused the message for another reason; it was not delivered.</summary>
    Rejected = 4
}
