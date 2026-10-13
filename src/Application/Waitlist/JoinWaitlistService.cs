using System.Net.Mail;
using System.Text.RegularExpressions;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Waitlist;

/// <summary>What a waitlist form may say. The pages of the site (<c>site/data/learn.mjs</c>) use the same keys.</summary>
public static class WaitlistOptions
{
    public static readonly IReadOnlySet<string> Languages =
        new HashSet<string> { "georgian", "armenian", "azerbaijani", "kazakh", "uzbek" };

    public static readonly IReadOnlySet<string> Platforms =
        new HashSet<string> { "telegram", "whatsapp", "ios", "android", "web" };

    /// <summary>The table's ceiling for one day (UTC): a flood of made-up addresses stops here.</summary>
    public const int MaxPerDay = 2000;
}

public enum JoinWaitlistResult
{
    Joined,

    /// <summary>The address is already on the list for this language; nothing changed.</summary>
    AlreadyJoined,

    /// <summary>Not an e-mail address, or a language or a platform the form does not have.</summary>
    Invalid,

    /// <summary>The day's ceiling is reached; nothing was written.</summary>
    Full
}

/// <summary>
/// Puts an address on the waitlist of a language (<see cref="WaitlistEntry"/>).
/// Service per ARCHITECTURE.md.
/// </summary>
public partial class JoinWaitlistService(ITraleDbContext db, ILogger<JoinWaitlistService> logger)
{
    [GeneratedRegex("[^a-z0-9_-]")]
    private static partial Regex NotTagCharacter();

    public async Task<JoinWaitlistResult> ExecuteAsync(
        string? email, string? language, string? platform, string? source, CancellationToken ct)
    {
        var address = NormalizeEmail(email);
        language = language?.Trim().ToLowerInvariant();
        platform = platform?.Trim().ToLowerInvariant();
        if (address == null || language == null || platform == null
            || !WaitlistOptions.Languages.Contains(language) || !WaitlistOptions.Platforms.Contains(platform))
        {
            return JoinWaitlistResult.Invalid;
        }

        if (await db.WaitlistEntries.AnyAsync(e => e.Email == address && e.Language == language, ct))
        {
            return JoinWaitlistResult.AlreadyJoined;
        }

        var dayStart = DateTime.UtcNow.Date;
        if (await db.WaitlistEntries.CountAsync(e => e.CreatedAtUtc >= dayStart, ct) >= WaitlistOptions.MaxPerDay)
        {
            logger.LogWarning("Waitlist: the daily ceiling of {Max} entries is reached", WaitlistOptions.MaxPerDay);
            return JoinWaitlistResult.Full;
        }

        db.WaitlistEntries.Add(new WaitlistEntry
        {
            Id = Guid.NewGuid(),
            Email = address,
            Language = language,
            Platform = platform,
            Source = NormalizeSource(source),
            CreatedAtUtc = DateTime.UtcNow
        });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // The same address sent twice at once: the unique index kept one row.
            return JoinWaitlistResult.AlreadyJoined;
        }

        // The address itself is not logged.
        logger.LogInformation("Waitlist: one more for {Language} on {Platform}", language, platform);
        return JoinWaitlistResult.Joined;
    }

    /// <summary>The address trimmed and lower-cased, or null when it is not one.</summary>
    public static string? NormalizeEmail(string? email)
    {
        var value = email?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(value) || value.Length > 254 || value.Any(char.IsWhiteSpace)
            || !MailAddress.TryCreate(value, out var parsed) || parsed.Address != value)
        {
            return null;
        }

        var host = parsed.Host;
        return host.Contains('.') && !host.StartsWith('.') && !host.EndsWith('.') ? value : null;
    }

    private static string NormalizeSource(string? source)
    {
        var tag = NotTagCharacter().Replace((source ?? string.Empty).Trim().ToLowerInvariant(), "_");
        return tag.Length > 64 ? tag[..64] : tag;
    }
}
