using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Translation.Pipeline;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Verbs;

/// <param name="Outcome">
/// "done"; "not-found"; "not-model-made" (a curated verb or one from a source table — never touched);
/// "no-such-tense" (the verb has no such row, or the tense key is unknown); "present-stays" (the present
/// cannot be removed, and its "he/she" cell is the lemma); "invalid-cells" with <paramref name="Problem"/>.
/// </param>
/// <param name="ProgressReset">How many learners' per-form progress rows were dropped because their form changed or went away.</param>
public record TenseReviewResult(string Outcome, string? Problem = null, int ProgressReset = 0);

/// <summary>
/// The owner's hand on a model-made verb, one tense at a time: confirm a row (it becomes verified and
/// enters games), write its cells by hand (verified too), or remove it. Every action is appended to
/// <see cref="VerbProvenance.TenseReviewsJson"/> with who, when and the row before and after.
/// <para>
/// Learners' progress is kept per verb, tense and person, not per spelling. Confirming changes nothing
/// in it. A cell whose form was changed or emptied loses its progress rows — what was learned there was
/// another word; the other cells of the row keep theirs. Removing a row drops the progress of its cells.
/// The verb's level never goes down (<see cref="UserVerb.Level"/>), so nobody is thrown back.
/// </para>
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbTenseReviewService(ITraleDbContext dbContext, RuntimeVerbStore store, ILogger<VerbTenseReviewService> logger)
{
    public Task<TenseReviewResult> ConfirmAsync(string lemma, string tense, long by, CancellationToken ct) =>
        ApplyAsync(lemma, tense, by, TenseReview.Confirmed, row => (row, null), ct);

    /// <param name="cells">Six cells in person order; null or empty — the cell is left empty. One Georgian word each.</param>
    public Task<TenseReviewResult> EditAsync(string lemma, string tense, IReadOnlyList<string?>? cells, long by, CancellationToken ct) =>
        ApplyAsync(lemma, tense, by, TenseReview.Edited, row =>
        {
            var clean = (cells ?? []).Select(c => string.IsNullOrWhiteSpace(c) ? null : c.Trim()).ToList();
            if (clean.Count != 6)
            {
                return (null, "six cells are needed: я, ты, он, мы, вы, они");
            }

            var bad = clean.Where(c => c != null && (c.Length > VerbParadigm.MaxFormLength || !VerbParadigm.GeorgianWord.IsMatch(c))).ToList();
            if (bad.Count > 0)
            {
                return (null, $"every cell is one word in Georgian script: {string.Join(", ", bad)}");
            }

            if (clean.All(c => c == null))
            {
                return (null, "an empty row is a removed tense: use remove");
            }

            // A cell that keeps one of its variants keeps them all; a changed cell gets the one new word.
            return (clean.Select((c, person) => c == null ? [] : row[person].Contains(c) ? row[person] : new[] { c }).ToArray(), null);
        }, ct);

    public Task<TenseReviewResult> RemoveAsync(string lemma, string tense, long by, CancellationToken ct) =>
        ApplyAsync(lemma, tense, by, TenseReview.Removed, _ => (null, null), ct);

    /// <summary>
    /// «Глагол проверен»: the owner approves the verb as a whole. Every tense that was still unverified
    /// is confirmed (each recorded as such), the verb becomes <see cref="VerbStatus.OwnerApproved"/> —
    /// for learners a verified verb: no "made by a model" mark, every tense in games — and who and when
    /// goes to the provenance.
    /// </summary>
    /// <param name="confirmAll">False: refuse while unverified tenses remain ("has-unverified-tenses").</param>
    public async Task<TenseReviewResult> ApproveVerbAsync(string lemma, bool confirmAll, long by, CancellationToken ct)
    {
        var verb = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == lemma, ct);
        var provenance = verb == null ? null : await dbContext.VerbProvenances.FirstOrDefaultAsync(p => p.VerbId == verb.Id, ct);
        if (verb == null)
        {
            return new TenseReviewResult("not-found");
        }

        if (!RuntimeVerbStore.IsModelMade(verb) || provenance == null)
        {
            return new TenseReviewResult("not-model-made");
        }

        var card = JsonNode.Parse(verb.CardJson)!;
        var tenses = card["tenses"].Deserialize<Dictionary<string, string[][]>>() ?? [];
        var unverified = VerbVerification.Of(card).Where(tenses.ContainsKey).ToList();
        if (unverified.Count > 0 && !confirmAll)
        {
            return new TenseReviewResult("has-unverified-tenses");
        }

        var now = DateTime.UtcNow;
        var reviews = VerbVerification.Reviews(provenance.TenseReviewsJson).ToList();
        reviews.AddRange(unverified.Select(t => new TenseReview(t, TenseReview.Confirmed, by, now, Cells(tenses[t]), Cells(tenses[t]))));
        reviews.Add(new TenseReview(TenseReview.WholeVerb, TenseReview.VerbApproved, by, now, null, null));
        provenance.TenseReviewsJson = VerbVerification.Serialize(reviews);
        provenance.OwnerApprovedAtUtc = now;
        provenance.OwnerApprovedBy = by;
        verb.Status = VerbStatus.OwnerApproved;
        await store.RewriteGeneratedAsync(verb, tenses, [], ct);
        await dbContext.SaveChangesAsync(ct);
        logger.LogInformation("Verb {Lemma} approved as a whole by the owner; tenses confirmed with it: {Count}", lemma, unverified.Count);
        return new TenseReviewResult("done");
    }

    /// <summary>«Снять отметку»: the verb is a model-made one to be looked over again. Its tenses stay as they are.</summary>
    public async Task<TenseReviewResult> UnapproveVerbAsync(string lemma, long by, CancellationToken ct)
    {
        var verb = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == lemma, ct);
        var provenance = verb == null ? null : await dbContext.VerbProvenances.FirstOrDefaultAsync(p => p.VerbId == verb.Id, ct);
        if (verb == null)
        {
            return new TenseReviewResult("not-found");
        }

        if (!RuntimeVerbStore.IsModelMade(verb) || provenance == null)
        {
            return new TenseReviewResult("not-model-made");
        }

        if (verb.Status != VerbStatus.OwnerApproved)
        {
            return new TenseReviewResult("done");
        }

        var reviews = VerbVerification.Reviews(provenance.TenseReviewsJson).ToList();
        reviews.Add(new TenseReview(TenseReview.WholeVerb, TenseReview.VerbUnapproved, by, DateTime.UtcNow, null, null));
        provenance.TenseReviewsJson = VerbVerification.Serialize(reviews);
        provenance.OwnerApprovedAtUtc = null;
        provenance.OwnerApprovedBy = null;
        verb.Status = VerbStatus.Generated;
        var tenses = JsonNode.Parse(verb.CardJson)!["tenses"].Deserialize<Dictionary<string, string[][]>>() ?? [];
        await store.RewriteGeneratedAsync(verb, tenses, VerbVerification.Of(verb.CardJson), ct);
        await dbContext.SaveChangesAsync(ct);
        return new TenseReviewResult("done");
    }

    private async Task<TenseReviewResult> ApplyAsync(
        string lemma, string tense, long by, string action, Func<string[][], (string[][]? Row, string? Problem)> change, CancellationToken ct)
    {
        var verb = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == lemma, ct);
        if (verb == null)
        {
            return new TenseReviewResult("not-found");
        }

        if (!RuntimeVerbStore.IsModelMade(verb))
        {
            return new TenseReviewResult("not-model-made");
        }

        var card = JsonNode.Parse(verb.CardJson)!;
        var tenses = card["tenses"].Deserialize<Dictionary<string, string[][]>>() ?? [];
        if (!VerbAnalyzer.KnownTenses.Contains(tense) || !tenses.TryGetValue(tense, out var before) || before.Length != 6)
        {
            return new TenseReviewResult("no-such-tense");
        }

        var (after, problem) = change(before);
        if (problem != null)
        {
            return new TenseReviewResult("invalid-cells", problem);
        }

        if (tense == "present" && (after == null || !after[2].Contains(verb.Lemma)))
        {
            return new TenseReviewResult("present-stays");
        }

        var provenance = await dbContext.VerbProvenances.FirstOrDefaultAsync(p => p.VerbId == verb.Id, ct);
        if (provenance == null)
        {
            return new TenseReviewResult("not-model-made");
        }

        var reviews = VerbVerification.Reviews(provenance.TenseReviewsJson).ToList();
        reviews.Add(new TenseReview(tense, action, by, DateTime.UtcNow, Cells(before), after == null ? null : Cells(after)));
        provenance.TenseReviewsJson = VerbVerification.Serialize(reviews);

        if (after == null)
        {
            tenses.Remove(tense);
            // The list of what the verb lacks says who took the row out.
            var missing = JsonSerializer.Deserialize<List<MissingTense>>(provenance.MissingTensesJson, MissingJson) ?? [];
            missing.RemoveAll(m => m.Tense == tense);
            if (VerbAnalyzer.CardTenses.Contains(tense))
            {
                missing.Add(new MissingTense(tense, MissingTense.RemovedByOwner));
            }

            provenance.MissingTensesJson = JsonSerializer.Serialize(missing, MissingJson);
        }
        else
        {
            tenses[tense] = after;
        }

        // Every other tense keeps its state; this one is settled by the owner (or gone).
        var unverified = VerbVerification.Of(card).Where(t => t != tense && tenses.ContainsKey(t)).ToList();
        await store.RewriteGeneratedAsync(verb, tenses, unverified, ct);

        // Progress of the cells whose word is not there any more.
        var changed = Enumerable.Range(0, 6)
            .Where(person => before[person].Length > 0 && (after == null || !before[person].Any(after[person].Contains)))
            .ToList();
        var stale = changed.Count == 0
            ? []
            : await dbContext.VerbFormProgresses
                .Where(p => p.VerbId == verb.Id && p.Tense == tense && changed.Contains(p.Person))
                .ToListAsync(ct);
        dbContext.VerbFormProgresses.RemoveRange(stale);

        await dbContext.SaveChangesAsync(ct);
        logger.LogInformation(
            "Verb {Lemma}: tense {Tense} {Action} by the owner; progress rows dropped: {Dropped}", lemma, tense, action, stale.Count);
        return new TenseReviewResult("done", ProgressReset: stale.Count);
    }

    private static readonly JsonSerializerOptions MissingJson = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>The row as six cells: the first variant of each, null for an empty one.</summary>
    private static string?[] Cells(string[][] row) => row.Select(cell => cell.Length == 0 ? null : cell[0]).ToArray();
}
