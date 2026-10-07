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
    IReadOnlyList<string> CompletedTenses);

/// <summary>
/// The list a later human revision works from: every verb that was written by a model and approved by
/// a model (<see cref="VerbProvenance"/>), newest first, the ones nobody has revised yet on top.
/// Service per ARCHITECTURE.md.
/// </summary>
public class ModelMadeVerbsQuery(ITraleDbContext dbContext)
{
    public const int MaxRows = 500;

    public async Task<IReadOnlyList<ModelMadeVerb>> ExecuteAsync(bool onlyUnrevised, CancellationToken ct)
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
                r.Lemma, r.Title, r.Translation, r.Provenance, r.Learners,
                VerbCompleteness.Of(
                    JsonNode.Parse(r.CardJson)?["tenses"].Deserialize<Dictionary<string, string[][]>>() ?? new Dictionary<string, string[][]>()),
                JsonSerializer.Deserialize<List<MissingTense>>(r.Provenance.MissingTensesJson, Json) ?? []))
            .ToList();
    }

    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static ModelMadeVerb Row(
        string lemma, string title, string translation, VerbProvenance provenance, int learners,
        VerbCompleteness completeness, List<MissingTense> stated) =>
        new(
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
            JsonSerializer.Deserialize<List<string>>(provenance.CompletedTensesJson) ?? []);
}
