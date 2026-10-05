using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>
/// Stores a verb that was resolved at a user's request, in the same shape the catalog seeder writes:
/// summary columns, the ready-to-serve card and the form index. What is stored once is served from
/// the database from then on. The curated catalog wins: if the lemma later appears in
/// <c>verbs.json</c>, <see cref="VerbCatalogSeeder"/> rewrites the row.
/// Service per ARCHITECTURE.md.
/// </summary>
public class RuntimeVerbStore(ITraleDbContext dbContext)
{
    /// <summary>Runtime verbs go after the whole catalog in the list.</summary>
    private const int SortOrderAfterCatalog = 1_000_000;

    /// <summary>How many catalog verbs to look through for a model verb of the same scheme.</summary>
    private const int ModelCandidates = 50;

    private static readonly JsonSerializerOptions Json = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>
    /// Adds the verb, or returns the one already stored under this lemma — an existing verb is never
    /// overwritten from here.
    /// </summary>
    /// <param name="status">
    /// <see cref="VerbStatus.Verified"/> when the forms come from a source table,
    /// <see cref="VerbStatus.Generated"/> when a model produced them.
    /// </param>
    public async Task<Verb> AddAsync(VerbParadigm paradigm, string translation, VerbStatus status, CancellationToken ct)
    {
        var existing = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == paradigm.Lemma, ct);
        if (existing != null)
        {
            return existing;
        }

        var analysis = VerbAnalyzer.Analyze(paradigm.Lemma, paradigm.Tenses);
        var model = await FindModelAsync(analysis, ct);
        var now = DateTime.UtcNow;
        var title = paradigm.Title;
        var present = ToJson(paradigm.Tenses.TryGetValue("present", out var persons) && persons.Length > 0 ? persons[0] : []);
        var tenses = ToJson(paradigm.Tenses);

        var card = new JsonObject
        {
            ["id"] = paradigm.Lemma,
            ["title"] = title,
            ["ru"] = translation,
            ["kind"] = analysis.Kind,
            ["present"] = present.DeepClone(),
            ["masdarWithPreverb"] = ToJson(paradigm.Masdar.Where(m => m != title)),
            ["reason"] = analysis.Reason,
            ["root"] = analysis.Root,
            ["oddTenses"] = ToJson(analysis.OddTenses),
            ["model"] = model,
            ["tenses"] = tenses.DeepClone(),
            // Example sentences are picked offline from Tatoeba; a runtime verb has none.
            ["sentences"] = new JsonArray(),
            ["source"] = paradigm.Source,
            ["revid"] = paradigm.Revid,
            ["status"] = StatusName(status)
        };
        var cardJson = card.ToJsonString(Json);

        var verb = new Verb
        {
            Id = Guid.NewGuid(),
            Lemma = paradigm.Lemma,
            Title = title,
            Translation = translation,
            Kind = analysis.Kind,
            PresentJson = present.ToJsonString(Json),
            CardJson = cardJson,
            Status = status,
            SortOrder = SortOrderAfterCatalog,
            ContentHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(cardJson))).ToLowerInvariant(),
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        var forms = VerbCatalogSeeder
            .BuildForms(verb.Id, new JsonObject { ["tenses"] = tenses, ["alt"] = ToJson(paradigm.Alt) })
            .ToList();

        dbContext.Verbs.Add(verb);
        dbContext.VerbForms.AddRange(forms);
        try
        {
            await dbContext.SaveChangesAsync(ct);
            return verb;
        }
        catch (DbUpdateException)
        {
            // Two requests resolved the same new verb at once and the other one won the unique lemma.
            // Nothing of ours may stay in the request's DbContext for the caller's own SaveChanges.
            foreach (var form in forms)
            {
                dbContext.Entry(form).State = EntityState.Detached;
            }

            dbContext.Entry(verb).State = EntityState.Detached;
            return await dbContext.Verbs.FirstAsync(v => v.Lemma == paradigm.Lemma, ct);
        }
    }

    public static string StatusName(VerbStatus status) => status == VerbStatus.Generated ? "generated" : "verified";

    /// <summary>
    /// The model verb of a scheme is the first catalog verb "by the pattern" with that scheme —
    /// the rule of <c>scripts/verbs/build-catalog.mjs</c>, applied to what is in the database.
    /// </summary>
    private async Task<JsonNode?> FindModelAsync(VerbAnalysis analysis, CancellationToken ct)
    {
        if (analysis.Scheme == null)
        {
            return null;
        }

        var candidates = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Status == VerbStatus.Verified && v.Kind == "pattern" && v.SortOrder < SortOrderAfterCatalog)
            .OrderBy(v => v.SortOrder)
            .Take(ModelCandidates)
            .Select(v => new { v.Lemma, v.Title, v.Translation, v.CardJson })
            .ToListAsync(ct);

        foreach (var candidate in candidates)
        {
            var tenses = JsonNode.Parse(candidate.CardJson)?["tenses"].Deserialize<Dictionary<string, string[][]>>();
            if (tenses != null && VerbAnalyzer.Analyze(candidate.Lemma, tenses).Scheme == analysis.Scheme)
            {
                return new JsonObject
                {
                    ["id"] = candidate.Lemma, ["title"] = candidate.Title, ["ru"] = candidate.Translation
                };
            }
        }

        return null;
    }

    private static JsonNode ToJson<T>(T value) => JsonSerializer.SerializeToNode(value, Json)!;
}
