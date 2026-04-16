using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Queries;

/// <summary>
/// Activity days for the user's profile streak heatmap.
/// "Active" = added at least one vocabulary entry that day. Service per ARCHITECTURE.md.
/// </summary>
public class GetActivityDaysQuery(ITraleDbContext db)
{
    public async Task<List<string>> ExecuteAsync(Guid userId, int days, CancellationToken ct)
    {
        if (days <= 0) days = 30;
        if (days > 365) days = 365;

        var since = DateTime.UtcNow.Date.AddDays(-days + 1);

        var dates = await db.VocabularyEntries
            .Where(v => v.UserId == userId && v.DateAddedUtc >= since)
            .Select(v => v.DateAddedUtc)
            .ToListAsync(ct);

        return dates
            .Select(d => d.Date)
            .Distinct()
            .OrderBy(d => d)
            .Select(d => d.ToString("yyyy-MM-dd"))
            .ToList();
    }
}
