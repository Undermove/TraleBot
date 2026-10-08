using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

public record VerbFormProgressState(
    string Tense, int Person, int Step, int BestStep, int Reviews, DateTime? NextDueAtUtc, bool Due);

/// <summary>A verb's ladder for one user. <see cref="CanLearn"/> is true for every stored verb (it used to exclude model-made ones).</summary>
/// <param name="Curated">The verb comes from the curated catalog (not written by a model).</param>
public record VerbProgressState(string Lemma, bool CanLearn, int Total, IReadOnlyList<VerbFormProgressState> Forms, bool Curated = true);

/// <summary>The state of one form after an answer, as the mini-app reports it.</summary>
public record VerbFormStep(string Tense, int Person, int Step, int Reviews, DateTime AtUtc);

public record VerbInProgress(
    string Lemma, string Title, string Translation, int Started, int Mastered, int Total, int Due, DateTime UpdatedAtUtc);

public record VerbProgressSummary(IReadOnlyList<VerbInProgress> Verbs, int DueForms);

/// <summary>
/// Per-form learning progress for the verb "ladder": load one verb's state, save answered steps,
/// and tell what is in progress / due for repetition.
/// The mini-app decides which task comes next; the server stores the outcome, owns the repetition
/// schedule and refuses anything that is not a real cell of the verb.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbProgressService(ITraleDbContext dbContext)
{
    /// <summary>A ladder has at most 36 forms; anything much larger is not a ladder save.</summary>
    public const int MaxBatchSize = 100;

    /// <summary>The six main tenses the ladder teaches — same set as the verb card (CARD_TENSES in the mini-app).</summary>
    private static readonly string[] LadderTenses =
        { "present", "aorist", "imperfect", "optative", "conditional", "future" };

    /// <summary>
    /// A learner who practises "every evening" rarely comes back exactly 24 hours later;
    /// the slack keeps yesterday's forms due today.
    /// </summary>
    private static readonly TimeSpan DueSlack = TimeSpan.FromHours(4);

    /// <summary>
    /// Short fixed intervals: for grammar forms 1–3 days is enough, an expanding schedule does not pay off.
    /// </summary>
    public static TimeSpan RepeatAfter(int reviews) =>
        TimeSpan.FromDays(reviews switch { <= 0 => 1, 1 => 2, _ => 3 }) - DueSlack;

    /// <summary>Null when there is no such verb.</summary>
    public async Task<VerbProgressState?> GetAsync(Guid userId, string lemma, DateTime now, CancellationToken ct)
    {
        var verb = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Lemma == lemma)
            .Select(v => new { v.Id, v.Status, v.CardJson })
            .FirstOrDefaultAsync(ct);
        if (verb == null)
        {
            return null;
        }

        // A verb written by a model and approved by a second one is learned like any other.
        var cells = LadderCells(verb.CardJson);

        var rows = await dbContext.VerbFormProgresses
            .AsNoTracking()
            .Where(p => p.UserId == userId && p.VerbId == verb.Id)
            .ToListAsync(ct);

        var forms = rows
            .Where(p => cells.Contains((p.Tense, p.Person)))
            .OrderBy(p => Array.IndexOf(LadderTenses, p.Tense))
            .ThenBy(p => p.Person)
            .Select(p => new VerbFormProgressState(
                p.Tense, p.Person, p.Step, p.BestStep, p.Reviews, p.NextDueAtUtc, IsDue(p.Step, p.NextDueAtUtc, now)))
            .ToList();
        return new VerbProgressState(lemma, true, cells.Count, forms, verb.Status == VerbStatus.Verified);
    }

    /// <summary>
    /// Stores the reported steps and returns the verb's state after that; null when there is no such verb.
    /// Safe to replay: each form is last-write-wins by the time of the answer, so a batch that arrives
    /// twice, late or out of order never rolls a form back. Steps for cells the verb does not have
    /// are skipped rather than failing the whole batch — the client may be replaying an old queue.
    /// </summary>
    public async Task<VerbProgressState?> SaveAsync(
        Guid userId, string lemma, IReadOnlyCollection<VerbFormStep> steps, DateTime now, CancellationToken ct)
    {
        var verb = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Lemma == lemma)
            .Select(v => new { v.Id, v.Status, v.CardJson })
            .FirstOrDefaultAsync(ct);
        if (verb == null)
        {
            return null;
        }

        if (steps.Count > 0)
        {
            var cells = LadderCells(verb.CardJson);
            var existing = await dbContext.VerbFormProgresses
                .Where(p => p.UserId == userId && p.VerbId == verb.Id)
                .ToListAsync(ct);
            var byCell = existing.ToDictionary(p => (p.Tense, p.Person));

            // Several entries for one form in a batch: only the latest answer matters.
            var latest = steps
                .Where(s => s.Tense != null && cells.Contains((s.Tense, s.Person)))
                .Where(s => s.Step is >= 1 and <= VerbFormProgress.MasteredStep)
                .GroupBy(s => (s.Tense, s.Person))
                .Select(g => g.OrderBy(s => s.AtUtc).Last());

            foreach (var step in latest)
            {
                // A client clock that runs ahead must not make its answers unbeatable or due dates drift.
                var at = step.AtUtc > now ? now : step.AtUtc;
                byCell.TryGetValue((step.Tense, step.Person), out var row);
                if (row != null && at <= row.UpdatedAtUtc)
                {
                    continue;
                }

                if (row == null)
                {
                    row = new VerbFormProgress
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        VerbId = verb.Id,
                        Tense = step.Tense,
                        Person = step.Person,
                        CreatedAtUtc = now
                    };
                    dbContext.VerbFormProgresses.Add(row);
                }

                var reviews = Math.Max(0, step.Reviews);
                var mastered = step.Step == VerbFormProgress.MasteredStep;
                var sameMastery = row.Step == VerbFormProgress.MasteredStep && row.Reviews == reviews
                                                                             && row.NextDueAtUtc != null;
                row.NextDueAtUtc = !mastered ? null
                    : sameMastery ? row.NextDueAtUtc
                    : at + RepeatAfter(reviews);
                row.Step = step.Step;
                row.BestStep = Math.Max(row.BestStep, step.Step);
                row.Reviews = reviews;
                row.UpdatedAtUtc = at;
            }

            await dbContext.SaveChangesAsync(ct);
        }

        return await GetAsync(userId, lemma, now, ct);
    }

    /// <summary>
    /// Verbs the user has started, most recently practised first, with how many forms are due —
    /// what a "continue verb X" entry point needs.
    /// </summary>
    public async Task<VerbProgressSummary> GetSummaryAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        var rows = await dbContext.VerbFormProgresses
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => new { p.VerbId, p.Tense, p.Person, p.Step, p.NextDueAtUtc, p.UpdatedAtUtc })
            .ToListAsync(ct);
        if (rows.Count == 0)
        {
            return new VerbProgressSummary(new List<VerbInProgress>(), 0);
        }

        var verbIds = rows.Select(r => r.VerbId).Distinct().ToList();
        var verbs = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => verbIds.Contains(v.Id))
            .Select(v => new { v.Id, v.Lemma, v.Title, v.Translation, v.CardJson })
            .ToListAsync(ct);

        var result = new List<VerbInProgress>();
        foreach (var verb in verbs)
        {
            var cells = LadderCells(verb.CardJson);
            var own = rows.Where(r => r.VerbId == verb.Id && cells.Contains((r.Tense, r.Person))).ToList();
            if (own.Count == 0)
            {
                continue;
            }

            result.Add(new VerbInProgress(
                verb.Lemma,
                verb.Title,
                verb.Translation,
                Started: own.Count,
                Mastered: own.Count(r => r.Step == VerbFormProgress.MasteredStep),
                Total: cells.Count,
                Due: own.Count(r => IsDue(r.Step, r.NextDueAtUtc, now)),
                UpdatedAtUtc: own.Max(r => r.UpdatedAtUtc)));
        }

        result = result.OrderByDescending(v => v.UpdatedAtUtc).ToList();
        return new VerbProgressSummary(result, result.Sum(v => v.Due));
    }

    private static bool IsDue(int step, DateTime? nextDueAtUtc, DateTime now) =>
        step == VerbFormProgress.MasteredStep && nextDueAtUtc != null && nextDueAtUtc <= now;

    /// <summary>
    /// The cells the ladder teaches: main tenses of the main table that have a form. Read from the
    /// card the mini-app gets, so both sides count the same forms.
    /// </summary>
    private static HashSet<(string Tense, int Person)> LadderCells(string cardJson)
    {
        var cells = new HashSet<(string, int)>();
        var tenses = JsonNode.Parse(cardJson)?["tenses"]?.AsObject();
        if (tenses == null)
        {
            return cells;
        }

        foreach (var tense in LadderTenses)
        {
            if (tenses[tense] is not JsonArray persons)
            {
                continue;
            }

            for (var person = 0; person < persons.Count; person++)
            {
                if (persons[person] is JsonArray { Count: > 0 })
                {
                    cells.Add((tense, person));
                }
            }
        }

        return cells;
    }
}
