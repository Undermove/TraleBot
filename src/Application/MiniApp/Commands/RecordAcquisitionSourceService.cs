using System;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Commands;

/// <summary>
/// Records where a user first came from — the /start deep-link payload (e.g.
/// "site", "channel_neuralfordevs") or the mini-app start_param. First-touch
/// attribution: written once and never overwritten, so a later visit through a
/// different link doesn't rewrite the original source.
/// </summary>
public class RecordAcquisitionSourceService(ITraleDbContext db, ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<RecordAcquisitionSourceService>();

    private const int MaxLength = 64;

    // Telegram already restricts start params to [A-Za-z0-9_-]; mirror that and
    // drop anything else so a malformed tag can never reach the column.
    private static readonly Regex Allowed = new("^[A-Za-z0-9_-]{1,64}$", RegexOptions.Compiled);

    /// <summary>
    /// Normalizes a raw source tag to the stored form, or null if it isn't a valid
    /// source tag (empty, too long, or contains disallowed characters).
    /// </summary>
    public static string? Sanitize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();
        if (trimmed.Length > MaxLength) return null;
        if (!Allowed.IsMatch(trimmed)) return null;
        return trimmed.ToLowerInvariant();
    }

    public async Task<RecordAcquisitionSourceResult> ExecuteAsync(
        Guid userId, string? rawSource, CancellationToken ct)
    {
        var source = Sanitize(rawSource);
        if (source == null) return RecordAcquisitionSourceResult.InvalidSource;

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return RecordAcquisitionSourceResult.UserNotFound;

        // First-touch wins — never overwrite an existing source.
        if (!string.IsNullOrEmpty(user.AcquisitionSource))
        {
            return RecordAcquisitionSourceResult.AlreadySet;
        }

        user.AcquisitionSource = source;
        await db.SaveChangesAsync(ct);
        _logger.LogInformation("Acquisition source recorded: {User} <- {Source}", userId, source);
        return RecordAcquisitionSourceResult.Recorded;
    }
}

public enum RecordAcquisitionSourceResult
{
    Recorded,
    AlreadySet,
    InvalidSource,
    UserNotFound
}
