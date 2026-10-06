using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>
/// How many of the learner's own dictionary entries contain a known verb form — the same entries
/// the «глаголы» filter of the dictionary shows. Feeds the one verb line on the dashboard.
/// Service per ARCHITECTURE.md.
/// </summary>
public class DictionaryVerbsQuery(ITraleDbContext dbContext, VerbQueries verbs)
{
    public async Task<int> CountAsync(User user, CancellationToken ct)
    {
        var entries = await dbContext.VocabularyEntries
            .AsNoTracking()
            .Where(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage)
            .Select(v => new { v.Word, v.Definition })
            .ToListAsync(ct);
        if (entries.Count == 0)
        {
            return 0;
        }

        var hits = await verbs.FindInTextsAsync(entries.SelectMany(e => new[] { e.Word, e.Definition }).ToList(), ct);
        return entries.Count(e => hits.ContainsKey(e.Word) || hits.ContainsKey(e.Definition));
    }
}
