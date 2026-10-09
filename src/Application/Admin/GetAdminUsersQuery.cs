using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

/// <summary>
/// The owner's list of people: search by Telegram id (no name or username is stored), a filter by
/// access, the most recently active first, page by page.
/// </summary>
public class GetAdminUsersQuery(ITraleDbContext db)
{
    public const int MaxPage = 100;

    public async Task<AdminUsersPage> ExecuteAsync(
        string? search, AdminUserFilter filter, AdminUserSort sort, int skip, int take, CancellationToken ct)
    {
        take = Math.Clamp(take, 1, MaxPage);
        skip = Math.Max(skip, 0);
        var now = DateTime.UtcNow;

        var users = await db.Users.AsNoTracking().ToListAsync(ct);
        var lastActive = await UserActivity.LoadLastAsync(db, ct);
        var words = await db.VocabularyEntries.AsNoTracking()
            .GroupBy(v => v.UserId).Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.UserId, g => g.Count, ct);
        search = string.IsNullOrWhiteSpace(search) ? null : search.Trim();

        var counts = Enum.GetValues<AdminUserFilter>().ToDictionary(f => f, f => users.Count(u => Matches(u, f, now)));
        var found = users
            .Where(u => Matches(u, filter, now) && (search == null || u.TelegramId.ToString().Contains(search)))
            .Select(u => new AdminUserRow(
                u.TelegramId, AccessOf(u, now), u.IsActive, u.RegisteredAtUtc,
                lastActive.TryGetValue(u.Id, out var at) ? at : null, u.AcquisitionSource, words.GetValueOrDefault(u.Id)));
        var ordered = (sort switch
        {
            AdminUserSort.Registered => found.OrderByDescending(u => u.RegisteredAtUtc),
            AdminUserSort.Words => found.OrderByDescending(u => u.VocabularyCount).ThenByDescending(u => u.RegisteredAtUtc),
            _ => found.OrderByDescending(u => u.LastActivityUtc ?? u.RegisteredAtUtc)
        }).ToList();

        return new AdminUsersPage(ordered.Count, ordered.Skip(skip).Take(take).ToList(), counts);
    }

    private static bool Matches(User user, AdminUserFilter filter, DateTime now) => filter switch
    {
        AdminUserFilter.Paying => user.HasActivePro(now),
        AdminUserFilter.Trial => user.HasActiveTrial(now),
        AdminUserFilter.AccessEnded => !user.HasMiniAppAccess(now),
        AdminUserFilter.Blocked => !user.IsActive,
        _ => true
    };

    public static AdminUserAccess AccessOf(User user, DateTime now) =>
        user.HasActivePro(now) ? AdminUserAccess.Paying
        : user.HasActiveTrial(now) ? AdminUserAccess.Trial
        : user.IsPro ? AdminUserAccess.Lapsed
        : AdminUserAccess.Ended;
}

public enum AdminUserFilter
{
    All,
    /// <summary>A paid subscription that is active now (or Lifetime).</summary>
    Paying,
    /// <summary>Free access is running.</summary>
    Trial,
    /// <summary>No access now: never paid and the free one is over, or the subscription lapsed.</summary>
    AccessEnded,
    /// <summary>Blocked the bot.</summary>
    Blocked
}

public enum AdminUserSort
{
    /// <summary>The most recently active first; someone with no trace of studying counts from registration.</summary>
    Activity,
    /// <summary>The newest first.</summary>
    Registered,
    /// <summary>The largest personal dictionary first.</summary>
    Words
}

public enum AdminUserAccess
{
    Paying,
    Trial,
    /// <summary>Never paid, free access is over.</summary>
    Ended,
    /// <summary>Paid once, the subscription has lapsed.</summary>
    Lapsed
}

/// <param name="IsActive">False — blocked the bot.</param>
/// <param name="LastActivityUtc">Null — no dated trace of studying.</param>
public record AdminUserRow(
    long TelegramId, AdminUserAccess Access, bool IsActive, DateTime RegisteredAtUtc, DateTime? LastActivityUtc, string? AcquisitionSource,
    int VocabularyCount);

/// <param name="Total">How many match the search and the filter.</param>
/// <param name="Counts">How many people each filter has, whatever the search.</param>
public record AdminUsersPage(int Total, IReadOnlyList<AdminUserRow> Users, IReadOnlyDictionary<AdminUserFilter, int> Counts);
