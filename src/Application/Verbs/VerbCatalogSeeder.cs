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
/// when its catalog entry changed, so restarts are cheap. Verbs that are not in the file
/// (e.g. generated at a user's request) are left untouched.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbCatalogSeeder(ITraleDbContext dbContext)
{
    private static readonly JsonSerializerOptions Json = new()
    {
        // Georgian and Russian stay readable in the stored payload instead of \uXXXX escapes.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public record Result(int Total, int Written);

    public async Task<Result> SeedAsync(string catalogJson, CancellationToken ct)
    {
        var entries = JsonNode.Parse(catalogJson)?["verbs"]?.AsArray()
                      ?? throw new InvalidOperationException("Verb catalog has no 'verbs' array");

        var existing = await dbContext.Verbs.ToDictionaryAsync(v => v.Lemma, ct);
        var now = DateTime.UtcNow;
        var written = 0;

        for (var i = 0; i < entries.Count; i++)
        {
            var entry = entries[i]!.AsObject();
            var lemma = entry["lemma"]!.GetValue<string>();
            var hash = Hash(entry.ToJsonString(Json) + "#" + i);

            existing.TryGetValue(lemma, out var verb);
            if (verb != null && verb.ContentHash == hash)
            {
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

        if (written > 0)
        {
            await dbContext.SaveChangesAsync(ct);
        }

        return new Result(entries.Count, written);
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
            ["source"] = entry["source"]?.DeepClone()
        };
        verb.CardJson = card.ToJsonString(Json);
    }

    /// <summary>
    /// Index rows for every form of the main paradigm and of the parallel tables (same verb with
    /// another preverb), so that both წავიდა and მივიდა lead to the verb "to go".
    /// </summary>
    private static IEnumerable<VerbForm> BuildForms(Guid verbId, JsonObject entry)
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

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
