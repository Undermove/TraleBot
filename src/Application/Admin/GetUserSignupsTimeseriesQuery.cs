using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

/// <summary>
/// Daily new-user counts over a window (default 30 days). Used for the admin chart.
/// </summary>
public class GetUserSignupsTimeseriesQuery(ITraleDbContext db)
{
    public async Task<List<TimeseriesPointDto>> ExecuteAsync(int days, CancellationToken ct)
    {
        if (days <= 0) days = 30;
        if (days > 365) days = 365;

        var now = DateTime.UtcNow;
        var since = now.Date.AddDays(-days + 1);

        var rows = await db.Users
            .Where(u => u.RegisteredAtUtc >= since)
            .Select(u => u.RegisteredAtUtc)
            .ToListAsync(ct);

        // Bucket by date in C# to avoid Postgres date_trunc translation issues
        var byDate = rows
            .GroupBy(d => d.Date)
            .ToDictionary(g => g.Key, g => g.Count());

        var points = new List<TimeseriesPointDto>(days);
        for (var i = 0; i < days; i++)
        {
            var date = since.AddDays(i);
            points.Add(new TimeseriesPointDto
            {
                Date = date.ToString("yyyy-MM-dd"),
                Count = byDate.TryGetValue(date, out var c) ? c : 0
            });
        }
        return points;
    }
}

public class TimeseriesPointDto
{
    public string Date { get; init; } = string.Empty;
    public int Count { get; init; }
}
