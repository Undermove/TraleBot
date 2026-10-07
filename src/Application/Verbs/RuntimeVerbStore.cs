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

    /// <summary>Column length of <c>Verb.Translation</c>.</summary>
    public const int MaxTranslationLength = 256;

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
    /// <see cref="VerbStatus.Generated"/> when a model wrote them and a second model approved them.
    /// </param>
    /// <param name="verification">In plain Russian: what the forms and the translation rest on — shown in the card.</param>
    /// <param name="meanings">Plain-Russian phrases of the forms, when the record has them — as catalog verbs do.</param>
    /// <param name="provenance">For a model-made verb: who wrote and who approved it. Saved with the verb, in one transaction.</param>
    /// <param name="lacksTenses">
    /// For a model-made verb short of tenses: true when the verb itself has no such tenses (the card says
    /// so), false when they are just not known.
    /// </param>
    public async Task<Verb> AddAsync(
        VerbParadigm paradigm,
        string translation,
        VerbStatus status,
        CancellationToken ct,
        string? verification = null,
        VerbMeanings? meanings = null,
        VerbProvenance? provenance = null,
        bool lacksTenses = false)
    {
        var existing = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == paradigm.Lemma, ct);
        if (existing != null)
        {
            return existing;
        }

        var now = DateTime.UtcNow;
        var verb = new Verb
        {
            Id = Guid.NewGuid(),
            Lemma = paradigm.Lemma,
            Title = string.Empty,
            Translation = string.Empty,
            Kind = string.Empty,
            PresentJson = "[]",
            CardJson = "{}",
            ContentHash = string.Empty,
            SortOrder = SortOrderAfterCatalog,
            CreatedAtUtc = now
        };
        var forms = await ApplyAsync(verb, paradigm, translation, status, verification, meanings, lacksTenses, now, ct);

        dbContext.Verbs.Add(verb);
        dbContext.VerbForms.AddRange(forms);
        if (provenance != null)
        {
            provenance.VerbId = verb.Id;
            dbContext.VerbProvenances.Add(provenance);
        }

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

            if (provenance != null)
            {
                dbContext.Entry(provenance).State = EntityState.Detached;
            }

            dbContext.Entry(verb).State = EntityState.Detached;
            return await dbContext.Verbs.FirstAsync(v => v.Lemma == paradigm.Lemma, ct);
        }
    }

    /// <summary>
    /// Rewrites a model-made verb with a new approved record: the row itself stays (its id is what the
    /// learners' progress and "my verbs" point to — they are keyed by verb, tense and person, so what was
    /// learned stays learned), the card, the summary columns and the form index are rebuilt, and the
    /// provenance row is brought up to date. Dictionary entries find their verb by the form's spelling,
    /// so an entry keeps its verb as long as its form is still in the table.
    /// </summary>
    /// <returns>False when the verb is not a model-made one — nothing is touched then.</returns>
    public async Task<bool> ReplaceGeneratedAsync(
        Verb verb, VerbParadigm paradigm, string translation, VerbMeanings meanings, VerbProvenance provenance, bool lacksTenses, CancellationToken ct)
    {
        if (verb.Status != VerbStatus.Generated || !IsRuntime(verb) || verb.Lemma != paradigm.Lemma)
        {
            return false;
        }

        var now = DateTime.UtcNow;
        var stale = await dbContext.VerbForms.Where(f => f.VerbId == verb.Id).ToListAsync(ct);
        dbContext.VerbForms.RemoveRange(stale);
        dbContext.VerbForms.AddRange(await ApplyAsync(verb, paradigm, translation, VerbStatus.Generated, null, meanings, lacksTenses, now, ct));

        var current = await dbContext.VerbProvenances.FirstOrDefaultAsync(p => p.VerbId == verb.Id, ct);
        if (current == null)
        {
            provenance.VerbId = verb.Id;
            dbContext.VerbProvenances.Add(provenance);
        }
        else
        {
            // The first request that led to the verb stays on record; a rebuilt record has not been revised.
            current.GeneratorModel = provenance.GeneratorModel;
            current.ReviewerModel = provenance.ReviewerModel;
            current.ApprovedAtUtc = provenance.ApprovedAtUtc;
            current.RepairRounds = provenance.RepairRounds;
            current.FormsTotal = provenance.FormsTotal;
            current.FormsAttested = provenance.FormsAttested;
            current.UnattestedFormsJson = provenance.UnattestedFormsJson;
            current.MissingTensesJson = provenance.MissingTensesJson;
            current.CompletedTensesJson = provenance.CompletedTensesJson;
            current.LemmaInLexicon = provenance.LemmaInLexicon;
            current.ReviewerReasons = provenance.ReviewerReasons;
            current.RevisedAtUtc = null;
        }

        await dbContext.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>Fills the verb's columns and card from the paradigm and returns its form index rows (not yet added).</summary>
    private async Task<List<VerbForm>> ApplyAsync(
        Verb verb,
        VerbParadigm paradigm,
        string translation,
        VerbStatus status,
        string? verification,
        VerbMeanings? meanings,
        bool lacksTenses,
        DateTime now,
        CancellationToken ct)
    {
        var analysis = VerbAnalyzer.Analyze(paradigm.Lemma, paradigm.Tenses);
        if (status == VerbStatus.Generated && VerbAnalyzer.IsPartial(paradigm.Tenses))
        {
            // The analyzer's wording speaks of "the source"; a generated verb has none. And when the
            // generator stated that the verb itself has no such tenses, the card says that.
            analysis = analysis with
            {
                Reason = lacksTenses
                    ? analysis.Reason.Replace("В источнике есть только часть времён", "У этого глагола есть не все времена")
                    : analysis.Reason.Replace("В источнике есть", "Известна")
            };
        }

        var model = await FindModelAsync(analysis, ct);
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
            ["meanings"] = ToJson(meanings?.Meanings ?? new Dictionary<string, string[]>()),
            ["meaningChips"] = ToJson(meanings?.Chips ?? new Dictionary<string, string>()),
            // Example sentences are picked offline from Tatoeba; a runtime verb has none.
            ["sentences"] = new JsonArray(),
            ["source"] = paradigm.Source,
            ["revid"] = paradigm.Revid,
            ["status"] = StatusName(status),
            ["verification"] = verification
        };
        var cardJson = card.ToJsonString(Json);

        verb.Title = title;
        verb.Translation = translation;
        verb.Kind = analysis.Kind;
        verb.PresentJson = present.ToJsonString(Json);
        verb.CardJson = cardJson;
        verb.Status = status;
        verb.ContentHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(cardJson))).ToLowerInvariant();
        verb.UpdatedAtUtc = now;

        return VerbCatalogSeeder
            .BuildForms(verb.Id, new JsonObject
            {
                ["tenses"] = tenses,
                ["alt"] = ToJson(paradigm.Alt),
                ["meanings"] = card["meanings"]!.DeepClone(),
                ["meaningChips"] = card["meaningChips"]!.DeepClone()
            })
            .ToList();
    }

    /// <summary>Whether the verb came from here and not from the curated catalog (whose glosses are hand-written).</summary>
    public static bool IsRuntime(Verb verb) =>
        !verb.ContentHash.StartsWith(VerbCatalogSeeder.CatalogMark, StringComparison.Ordinal);

    /// <summary>
    /// Adds one more Russian gloss to a runtime verb, so that the next request for that Russian word
    /// finds the verb in the base. The gloss of such a verb was written by a model in the first place.
    /// </summary>
    public async Task AddGlossAsync(Verb verb, string infinitive, CancellationToken ct)
    {
        var glosses = $"{verb.Translation}, {infinitive}";
        if (!IsRuntime(verb) || glosses.Length > MaxTranslationLength)
        {
            return;
        }

        var card = JsonNode.Parse(verb.CardJson)!;
        card["ru"] = glosses;
        verb.Translation = glosses;
        verb.CardJson = card.ToJsonString(Json);
        verb.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
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
