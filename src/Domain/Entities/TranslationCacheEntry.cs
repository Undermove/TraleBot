// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// A translation of a plain word or phrase that was already looked up once. Repeated lookups are
/// answered from here instead of the external dictionary sites — faster, and independent of their outages.
/// Shared between users: it stores no user data, only the looked-up text and its translation.
/// </summary>
public class TranslationCacheEntry
{
    public Guid Id { get; set; }

    /// <summary>Normalised looked-up text (see <c>TranslationCacheKey</c>). Unique together with <see cref="Direction"/>.</summary>
    public required string Key { get; set; }

    public TranslationDirection Direction { get; set; }

    public required string Definition { get; set; }
    public required string AdditionalInfo { get; set; }
    public required string Example { get; set; }

    /// <summary>Where the result came from: "external" (dictionary site / Google) or "verb-agent".</summary>
    public required string Source { get; set; }

    /// <summary>
    /// The cheap classifier has already looked at this text and it does not need the verb analysis.
    /// Entries written while the agent path was off are false, so they get classified once when it is turned on.
    /// </summary>
    public bool Classified { get; set; }

    public int HitCount { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastHitAtUtc { get; set; }
}

public enum TranslationDirection
{
    RussianToGeorgian = 0,
    GeorgianToRussian = 1
}
