using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>A verb a model wrote, with what its approval rested on — one row of the revision list.</summary>
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
    int Learners);

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
                p.Verb.Lemma, p.Verb.Title, p.Verb.Translation, Provenance = p,
                Learners = dbContext.UserVerbs.Count(u => u.VerbId == p.VerbId)
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new ModelMadeVerb(
                r.Lemma, r.Title, r.Translation, r.Provenance.AskedText, r.Provenance.GeneratorModel, r.Provenance.ReviewerModel,
                r.Provenance.ApprovedAtUtc, r.Provenance.RepairRounds, r.Provenance.FormsTotal, r.Provenance.FormsAttested,
                JsonSerializer.Deserialize<List<string>>(r.Provenance.UnattestedFormsJson) ?? [],
                r.Provenance.LemmaInLexicon,
                r.Provenance.ReviewerReasons.Split('\n', StringSplitOptions.RemoveEmptyEntries),
                r.Provenance.RevisedAtUtc,
                r.Learners))
            .ToList();
    }
}
