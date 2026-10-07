using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>
/// Brings model-made verbs stored before tenses had a verification state up to date: a card that does
/// not name its unverified tenses yet gets them by the same rule a new verb is stored with
/// (<see cref="VerbVerification"/>). Runs at startup after the catalog is seeded; a card that has the
/// property is left alone, so the owner's later decisions are never overwritten.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbVerificationBackfill(ITraleDbContext dbContext, RuntimeVerbStore store, IVerbLexicon lexicon)
{
    /// <returns>How many verbs were brought up to date.</returns>
    public async Task<int> RunAsync(CancellationToken ct)
    {
        var marker = $"\"{VerbVerification.CardProperty}\"";
        var verbs = await dbContext.Verbs
            .Where(v => v.Status == VerbStatus.Generated && !v.CardJson.Contains(marker))
            .ToListAsync(ct);
        foreach (var verb in verbs.Where(RuntimeVerbStore.IsRuntime))
        {
            var tenses = JsonNode.Parse(verb.CardJson)?["tenses"].Deserialize<Dictionary<string, string[][]>>() ?? [];
            var reviews = VerbVerification.Reviews(await dbContext.VerbProvenances
                .Where(p => p.VerbId == verb.Id).Select(p => p.TenseReviewsJson).FirstOrDefaultAsync(ct));
            await store.RewriteGeneratedAsync(verb, tenses, VerbVerification.UnverifiedTenses(tenses, lexicon, reviews), ct);
        }

        if (verbs.Count > 0)
        {
            await dbContext.SaveChangesAsync(ct);
        }

        return verbs.Count;
    }
}
