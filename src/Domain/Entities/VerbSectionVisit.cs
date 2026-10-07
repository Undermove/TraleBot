// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// How a learner came to the «Глаголы» section: one row per (user, source). The source is the tag
/// the mini-app was opened with — a campaign key from a broadcast button, the tag of a
/// <c>t.me/…?start=verbs_…</c> link — or <see cref="Home"/> for the dashboard tile. Unlike
/// <see cref="User.AcquisitionSource"/> (first touch, written once) this is recorded for people who
/// already use the app, so "of those who came by the link, how many played" can be answered later
/// (<c>scripts/sql/verbs-section-report.sql</c>).
/// </summary>
public class VerbSectionVisit
{
    /// <summary>The section was opened from the dashboard tile.</summary>
    public const string Home = "home";

    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;

    /// <summary>Sanitized like an acquisition tag: [a-z0-9_-], at most 64 characters.</summary>
    public required string Source { get; set; }

    public DateTime FirstOpenedAtUtc { get; set; }
    public DateTime LastOpenedAtUtc { get; set; }

    /// <summary>How many times the section was opened this way.</summary>
    public int Opens { get; set; }
}
