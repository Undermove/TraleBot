// ReSharper disable PropertyCanBeMadeInitOnly.Global

namespace Domain.Entities;

/// <summary>
/// Someone who asked, on a public page of the site (<c>/learn/&lt;language&gt;/</c>), to be told when a
/// course is ready: a language we do not teach yet, or one we do not teach in English yet. The rows
/// are the measure of demand — which language, on which platform — before anything is built. Not a
/// user of the bot: there is no account behind a row, only the address to write to once.
/// </summary>
public class WaitlistEntry
{
    public Guid Id { get; set; }

    /// <summary>Lower-cased and trimmed. One row per address and language.</summary>
    public required string Email { get; set; }

    /// <summary>The language the person wants to learn: one of <c>WaitlistOptions.Languages</c>.</summary>
    public required string Language { get; set; }

    /// <summary>Where they would use it: one of <c>WaitlistOptions.Platforms</c>.</summary>
    public required string Platform { get; set; }

    /// <summary>The tag of the link that brought them to the page (<c>?src=</c>); [a-z0-9_-], at most 64 characters, or empty.</summary>
    public string Source { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }
}
