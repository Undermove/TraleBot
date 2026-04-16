#pragma warning disable CS8618
namespace Domain.Entities;

/// <summary>
/// Record of a completed Telegram Stars payment.
/// Used for refunds (via TelegramPaymentChargeId) and analytics.
/// </summary>
public class Payment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public virtual User User { get; set; }

    /// <summary>Telegram's charge identifier — required to refund via refundStarPayment.</summary>
    public string TelegramPaymentChargeId { get; set; }

    /// <summary>Invoice payload we sent (e.g. "Stars_Pro_Year") — identifies the plan purchased.</summary>
    public string PayloadId { get; set; }

    public SubscriptionPlan Plan { get; set; }

    /// <summary>Amount in the payment currency (for XTR — stars count).</summary>
    public int Amount { get; set; }

    /// <summary>Payment currency code ("XTR" for Telegram Stars).</summary>
    public string Currency { get; set; }

    public DateTime PurchasedAtUtc { get; set; }

    /// <summary>Set when payment was refunded via Telegram API. Null otherwise.</summary>
    public DateTime? RefundedAtUtc { get; set; }
}
