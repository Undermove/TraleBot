using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.MiniApp.Commands;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>
/// Records that a learner opened the «Глаголы» section and by what way: the dashboard tile
/// (<see cref="VerbSectionVisit.Home"/>), a broadcast button (the campaign key) or a link with a tag.
/// One row per (user, source); later opens only move the counter and the last-open time.
/// Service per ARCHITECTURE.md.
/// </summary>
public class RecordVerbSectionVisitService(ITraleDbContext dbContext)
{
    /// <returns>The stored source, or null when the tag is not a valid one (nothing is recorded).</returns>
    public async Task<string?> ExecuteAsync(Guid userId, string? rawSource, DateTime now, CancellationToken ct)
    {
        var source = RecordAcquisitionSourceService.Sanitize(rawSource);
        if (source == null)
        {
            return null;
        }

        var visit = await dbContext.VerbSectionVisits.FirstOrDefaultAsync(v => v.UserId == userId && v.Source == source, ct);
        if (visit == null)
        {
            dbContext.VerbSectionVisits.Add(new VerbSectionVisit
            {
                Id = Guid.NewGuid(), UserId = userId, Source = source, FirstOpenedAtUtc = now, LastOpenedAtUtc = now, Opens = 1
            });
        }
        else
        {
            visit.LastOpenedAtUtc = now;
            visit.Opens++;
        }

        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Two opens at once (two tabs, a double request): the unique (user, source) row is already there.
        }

        return source;
    }
}
