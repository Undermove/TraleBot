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

namespace Application.Verbs;

/// <summary>A verb a model wrote, with what its approval rested on — one row of the revision list.</summary>
/// <param name="MainTenses">How many of the six main tenses the stored table has — a poor record is one with few.</param>
/// <param name="MissingTenses">The main tenses it lacks and why (a record stored before the reasons were kept: "not-sure").</param>
/// <param name="CompletedTenses">Main tenses the generator gave only when asked for them a second time.</param>
/// <param name="VerifiedMainTenses">How many of the main tenses are verified — the ones learners are taught.</param>
/// <param name="TenseReviews">What the owner did to the tenses by hand, oldest first.</param>
public record ModelMadeVerb(
    string Lemma,
    string Title,
    string Translation,
    string AskedText,
    string GeneratorModel,
    string ReviewerModel,
    DateTime ApprovedAtUtc,
    int RepairRounds,
    int FormsTotal,
    int FormsAttested,
    IReadOnlyList<string> UnattestedForms,
    bool LemmaInLexicon,
    IReadOnlyList<string> ReviewerReasons,
    DateTime? RevisedAtUtc,
    int Learners,
    int MainTenses,
    IReadOnlyList<MissingTense> MissingTenses,
    IReadOnlyList<string> CompletedTenses,
    int VerifiedMainTenses,
    IReadOnlyList<UnverifiedTense> UnverifiedTenses,
    IReadOnlyList<TenseReview> TenseReviews);

/// <summary>A tense of a model-made verb that nothing but the model vouches for — what the owner goes through.</summary>
/// <param name="Cells">Six cells in person order; null — the cell is empty.</param>
/// <param name="InTexts">Per cell: whether the form occurs in the corpora of real texts; null for an empty cell or when the corpus data is not loaded.</param>
/// <param name="Phrases">What each cell means in plain Russian, when the card has it.</param>
/// <param name="Completed">The row came on the completion round (the second ask).</param>
/// <param name="RemovedBefore">The owner removed this tense once and a rebuild brought it back.</param>
public record UnverifiedTense(
    string Tense, IReadOnlyList<string?> Cells, IReadOnlyList<bool?> InTexts, IReadOnlyList<string>? Phrases, bool Completed, bool RemovedBefore);

/// <summary>
/// The list a later human revision works from: every verb that was written by a model and approved by
/// a model (<see cref="VerbProvenance"/>), newest first, the ones nobody has revised yet on top.
/// Service per ARCHITECTURE.md.
/// </summary>
public class ModelMadeVerbsQuery(ITraleDbContext dbContext, IVerbLexicon lexicon)
{
    public const int MaxRows = 500;

    /// <param name="onlyUnverified">Only the verbs that have an unverified tense — the owner's "to check" list.</param>
    public async Task<IReadOnlyList<ModelMadeVerb>> ExecuteAsync(bool onlyUnrevised, CancellationToken ct, bool onlyUnverified = false)
    {
        var rows = await dbContext.VerbProvenances
            .AsNoTracking()
            .Where(p => p.Verb.Status == VerbStatus.Generated && (!onlyUnrevised || p.RevisedAtUtc == null))
            .OrderBy(p => p.RevisedAtUtc != null)
            .ThenByDescending(p => p.ApprovedAtUtc)
            .Take(MaxRows)
            .Select(p => new
            {
                p.Verb.Lemma, p.Verb.Title, p.Verb.Translation, p.Verb.CardJson, Provenance = p,
                Learners = dbContext.UserVerbs.Count(u => u.VerbId == p.VerbId)
            })
            .ToListAsync(ct);

        return rows
            .Select(r => Row(
                r.Lemma, r.Title, r.Translation, r.Provenance, r.Learners, JsonNode.Parse(r.CardJson)!,
                JsonSerializer.Deserialize<List<MissingTense>>(r.Provenance.MissingTensesJson, Json) ?? []))
            .Where(v => !onlyUnverified || v.UnverifiedTenses.Count > 0)
            .ToList();
    }

    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private ModelMadeVerb Row(
        string lemma, string title, string translation, VerbProvenance provenance, int learners, JsonNode card, List<MissingTense> stated)
    {
        var tenses = card["tenses"].Deserialize<Dictionary<string, string[][]>>() ?? new Dictionary<string, string[][]>();
        var phrases = card["meanings"]?.Deserialize<Dictionary<string, string[]>>() ?? new Dictionary<string, string[]>();
        var completeness = VerbCompleteness.Of(tenses);
        var completed = JsonSerializer.Deserialize<List<string>>(provenance.CompletedTensesJson) ?? [];
        var reviews = VerbVerification.Reviews(provenance.TenseReviewsJson);
        var unverified = VerbVerification.Of(card)
            .Where(tenses.ContainsKey)
            .Select(t => new UnverifiedTense(
                t,
                tenses[t].Select(cell => cell.Length == 0 ? null : cell[0]).ToList(),
                tenses[t].Select(cell => cell.Length == 0 || !lexicon.HasAttestedForms ? (bool?)null : lexicon.IsAttested(cell[0])).ToList(),
                phrases.GetValueOrDefault(t),
                completed.Contains(t),
                reviews.LastOrDefault(r => r.Tense == t)?.Action == TenseReview.Removed))
            .ToList();
        return new(
            lemma, title, translation, provenance.AskedText, provenance.GeneratorModel, provenance.ReviewerModel,
            provenance.ApprovedAtUtc, provenance.RepairRounds, provenance.FormsTotal, provenance.FormsAttested,
            JsonSerializer.Deserialize<List<string>>(provenance.UnattestedFormsJson) ?? [],
            provenance.LemmaInLexicon,
            provenance.ReviewerReasons.Split('\n', StringSplitOptions.RemoveEmptyEntries),
            provenance.RevisedAtUtc,
            learners,
            completeness.Tenses,
            // The table is the truth about what is missing; the provenance adds the reason where it has one.
            completeness.Missing
                .Select(t => stated.FirstOrDefault(m => m.Tense == t) ?? new MissingTense(t, MissingTense.NotSure))
                .ToList(),
            completed,
            completeness.Tenses - unverified.Count(u => VerbAnalyzer.CardTenses.Contains(u.Tense)),
            unverified,
            reviews);
    }
}
