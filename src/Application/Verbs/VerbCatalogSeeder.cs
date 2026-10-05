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
/// Loads the curated verb catalog (<c>src/Trale/Verbs/verbs.json</c>, built by
/// <c>scripts/verbs/build-catalog.mjs</c>) into the database. Idempotent: a verb is rewritten only
/// when its catalog entry changed, so restarts are cheap; a verb that merely moved in the catalog
/// gets its position updated without rewriting its forms.
/// The file is the source of truth for the verbs this seeder wrote (their <see cref="Verb.ContentHash"/>
/// carries <see cref="CatalogMark"/>): such a verb that is no longer in the file was struck out during
/// review (wrong forms, duplicate) and is deleted together with its forms. Verbs that came from
/// anywhere else — generated at a user's request, or verified by another route — are left untouched.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbCatalogSeeder(ITraleDbContext dbContext)
{
    private static readonly JsonSerializerOptions Json = new()
    {
        // Georgian and Russian stay readable in the stored payload instead of \uXXXX escapes.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>Prefix of <see cref="Verb.ContentHash"/> for rows owned by the curated catalog.</summary>
    public const string CatalogMark = "cat:";

    public record Result(int Total, int Written, int Removed = 0);

    public async Task<Result> SeedAsync(string catalogJson, CancellationToken ct)
    {
        var entries = JsonNode.Parse(catalogJson)?["verbs"]?.AsArray()
                      ?? throw new InvalidOperationException("Verb catalog has no 'verbs' array");
        if (entries.Count == 0)
        {
            // An empty catalog is a broken build, not an instruction to delete every verified verb.
            throw new InvalidOperationException("Verb catalog is empty");
        }

        var existing = await dbContext.Verbs.ToDictionaryAsync(v => v.Lemma, ct);
        var now = DateTime.UtcNow;
        var written = 0;
        var moved = 0;
        var inCatalog = new HashSet<string>();

        for (var i = 0; i < entries.Count; i++)
        {
            var entry = entries[i]!.AsObject();
            var lemma = entry["lemma"]!.GetValue<string>();
            // "#status": bump when the stored card gains a field, so already seeded rows are rewritten once.
            var hash = Hash(entry.ToJsonString(Json) + "#status");
            inCatalog.Add(lemma);

            existing.TryGetValue(lemma, out var verb);
            if (verb != null && verb.ContentHash == hash && verb.Status == VerbStatus.Verified)
            {
                // Same content, possibly a new place: the catalog is ordered by how common a verb is,
                // so adding one verb shifts many others. That must not rewrite thousands of form rows.
                if (verb.SortOrder != i)
                {
                    verb.SortOrder = i;
                    moved++;
                }

                continue;
            }

            if (verb == null)
            {
                verb = new Verb
                {
                    Id = Guid.NewGuid(),
                    Lemma = lemma,
                    Title = string.Empty,
                    Translation = string.Empty,
                    Kind = string.Empty,
                    PresentJson = "[]",
                    CardJson = "{}",
                    ContentHash = string.Empty,
                    CreatedAtUtc = now
                };
                dbContext.Verbs.Add(verb);
            }
            else
            {
                var stale = await dbContext.VerbForms.Where(f => f.VerbId == verb.Id).ToListAsync(ct);
                dbContext.VerbForms.RemoveRange(stale);
            }

            Apply(verb, entry, i, hash, now);
            dbContext.VerbForms.AddRange(BuildForms(verb.Id, entry));
            written++;
        }

        if (written > 0 || moved > 0)
        {
            await dbContext.SaveChangesAsync(ct);
        }

        // Saved separately, after the upserts: if a removal is ever blocked (say, by a foreign key
        // added later), the rest of the catalog is already up to date and the error is visible.
        var removed = existing.Values
            .Where(v => v.ContentHash.StartsWith(CatalogMark, StringComparison.Ordinal) && !inCatalog.Contains(v.Lemma))
            .ToList();
        if (removed.Count > 0)
        {
            dbContext.Verbs.RemoveRange(removed);
            await dbContext.SaveChangesAsync(ct);
        }

        return new Result(entries.Count, written, removed.Count);
    }

    private static void Apply(Verb verb, JsonObject entry, int order, string hash, DateTime now)
    {
        var tenses = entry["tenses"]!.AsObject();
        var present = tenses["present"]?[0]?.DeepClone() ?? new JsonArray();

        verb.Title = entry["title"]!.GetValue<string>();
        verb.Translation = entry["ru"]!.GetValue<string>();
        verb.Kind = entry["kind"]!.GetValue<string>();
        verb.PresentJson = present.ToJsonString(Json);
        verb.Status = VerbStatus.Verified;
        verb.SortOrder = order;
        verb.ContentHash = hash;
        verb.UpdatedAtUtc = now;

        // The card is stored exactly as the mini-app receives it.
        var card = new JsonObject
        {
            ["id"] = verb.Lemma,
            ["title"] = verb.Title,
            ["ru"] = verb.Translation,
            ["kind"] = verb.Kind,
            ["present"] = present.DeepClone(),
            ["masdarWithPreverb"] = entry["masdarWithPreverb"]?.DeepClone() ?? new JsonArray(),
            ["reason"] = entry["reason"]?.DeepClone(),
            ["root"] = entry["root"]?.DeepClone(),
            ["oddTenses"] = entry["oddTenses"]?.DeepClone() ?? new JsonArray(),
            ["model"] = entry["model"]?.DeepClone(),
            ["tenses"] = tenses.DeepClone(),
            // Real sentences (Tatoeba) that contain a form of this verb — material for exercises.
            ["sentences"] = entry["sentences"]?.DeepClone() ?? new JsonArray(),
            ["source"] = entry["source"]?.DeepClone(),
            ["status"] = RuntimeVerbStore.StatusName(VerbStatus.Verified)
        };
        verb.CardJson = card.ToJsonString(Json);
    }

    /// <summary>
    /// Index rows for every form of the main paradigm and of the parallel tables (same verb with
    /// another preverb), so that both წავიდა and მივიდა lead to the verb "to go".
    /// </summary>
    internal static IEnumerable<VerbForm> BuildForms(Guid verbId, JsonObject entry)
    {
        var tables = new List<JsonObject> { entry["tenses"]!.AsObject() };
        tables.AddRange((entry["alt"]?.AsArray() ?? new JsonArray()).Select(t => t!.AsObject()));

        var seen = new HashSet<(string Form, string Tense, int Person)>();
        foreach (var table in tables)
        {
            foreach (var (tense, persons) in table)
            {
                var rows = persons!.AsArray();
                for (var person = 0; person < rows.Count; person++)
                {
                    foreach (var variant in rows[person]!.AsArray())
                    {
                        var form = variant!.GetValue<string>();
                        if (!seen.Add((form, tense, person)))
                        {
                            continue;
                        }

                        yield return new VerbForm
                        {
                            Id = Guid.NewGuid(),
                            VerbId = verbId,
                            Form = form,
                            Tense = tense,
                            Person = person
                        };
                    }
                }
            }
        }
    }

    // The column holds 64 characters, so the mark takes the place of the last hex digits.
    private static string Hash(string value) =>
        CatalogMark + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)))
            .ToLowerInvariant()[..(64 - CatalogMark.Length)];
}
