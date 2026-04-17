#pragma warning disable CS8618
namespace Domain.Entities;

/// <summary>
/// One row per "user A invited user B" event. Source of truth for the referral
/// funnel (clicks → registered → activated). No FK back into User — lookups go
/// through this table directly, keeping User.cs untouched.
/// </summary>
public class Referral
{
    public Guid Id { get; set; }

    public Guid ReferrerUserId { get; set; }
    public Guid RefereeUserId { get; set; }

    /// <summary>When the referee registered via the deep-link.</summary>
    public DateTime CreatedAtUtc { get; set; }

    /// <summary>When the activation trigger fired. Null until the referee
    /// actually does something meaningful in the app.</summary>
    public DateTime? ActivatedAtUtc { get; set; }

    /// <summary>What triggered activation: "first_lesson" / "vocab_5" / "purchase".
    /// Null while ActivatedAtUtc is null.</summary>
    public string? ActivationTrigger { get; set; }

    /// <summary>Days of Pro/trial added to referrer at activation. Zero if capped.</summary>
    public int BonusReferrerDays { get; set; }

    /// <summary>Days of trial added to referee at registration.</summary>
    public int BonusRefereeDays { get; set; }
}
