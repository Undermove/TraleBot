#pragma warning disable CS8618
namespace Domain.Entities;

/// <summary>
/// One owner broadcast: who it is for and what is sent. Recipients are fixed row by row in
/// <see cref="BroadcastDelivery"/>, so a campaign can be sent in parts (a test sample first,
/// the rest later) without anyone receiving it twice, and its results can be measured afterwards.
/// </summary>
public class BroadcastCampaign
{
    public Guid Id { get; set; }

    /// <summary>Owner-chosen name, unique: "referral-2026-10". Also travels in the button URL
    /// (<c>?c=key</c>) so the mini-app can report an open.</summary>
    public string Key { get; set; }

    public BroadcastAudience Audience { get; set; }
    public string Message { get; set; }

    /// <summary>Text of the web-app button; null — the message goes without a button.</summary>
    public string? ButtonText { get; set; }

    /// <summary>Query string the button opens the mini-app with ("screen=vocabulary"); empty — the main screen.</summary>
    public string? ButtonQuery { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}

/// <summary>Who a campaign is for. Decided by the same entitlement helpers on <see cref="User"/>
/// the mini-app uses, at the moment recipients are picked.</summary>
public enum BroadcastAudience
{
    /// <summary>Never paid, free access is over.</summary>
    AccessEnded = 0,
    /// <summary>Never paid, free access is running.</summary>
    OnTrial = 1,
    /// <summary>Has a paid subscription that is active now (or Lifetime).</summary>
    Paying = 2,
    /// <summary>Paid once, the subscription has lapsed.</summary>
    ProLapsed = 3,
    /// <summary>Only the owner — to see the message on one's own phone.</summary>
    Owner = 4
}
