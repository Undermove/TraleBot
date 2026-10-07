using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>A dictionary entry seen as a verb.</summary>
/// <param name="Single">
/// The entry IS one verb form (its Georgian side is exactly the form), not a phrase that merely
/// contains one. Such an entry opens the verb view directly and shows the verb's level.
/// </param>
public record DictionaryVerbHit(VerbFormHit Hit, bool Single, VerbLevel Level);

/// <summary>One of the learner's verbs: saved in the dictionary (in any form), started, or both.</summary>
/// <param name="SavedForms">Forms of this verb found in the dictionary, in dictionary order; empty for a verb started elsewhere.</param>
public record MyVerb(string Lemma, string Title, string Translation, VerbLevel Level, bool Started, IReadOnlyList<VerbFormHit> SavedForms);

/// <param name="Entries">Aligned with the entries passed in; null where the entry has no verb form.</param>
public record MyVerbs(IReadOnlyList<DictionaryVerbHit?> Entries, IReadOnlyList<MyVerb> Verbs);

/// <summary>
/// "My verbs" = verbs whose forms are in the learner's dictionary ∪ verbs the learner has started
/// (from a lesson, a translation or the dictionary). Several saved forms of one verb are one verb.
/// Service per ARCHITECTURE.md.
/// </summary>
public class MyVerbsQuery(ITraleDbContext dbContext, VerbQueries verbs)
{
    public async Task<MyVerbs> GetAsync(
        Guid userId, IReadOnlyList<(string Word, string Definition)> entries, CancellationToken ct)
    {
        var hits = await verbs.FindInTextsAsync(entries.SelectMany(e => new[] { e.Word, e.Definition }).ToList(), ct);
        var started = await dbContext.UserVerbs
            .AsNoTracking()
            .Where(v => v.UserId == userId)
            .OrderByDescending(v => v.LastPlayedAtUtc ?? v.StartedAtUtc)
            .Select(v => new { v.Verb.Lemma, v.Verb.Title, v.Verb.Translation, v.Level })
            .ToListAsync(ct);
        var levels = started.ToDictionary(v => v.Lemma, v => v.Level);
        VerbLevel LevelOf(string lemma) => levels.GetValueOrDefault(lemma, VerbLevel.New);

        var found = entries.Select(e => Find(e.Word, e.Definition, hits)).ToList();
        var byEntry = found
            .Select(f => f == null ? null : new DictionaryVerbHit(f.Value.Hit, f.Value.Single, LevelOf(f.Value.Hit.Lemma)))
            .ToList();

        var saved = found
            .Where(f => f != null)
            .Select(f => f!.Value.Hit)
            .GroupBy(h => h.Lemma)
            .ToDictionary(g => g.Key, g => g.DistinctBy(h => h.Form).ToList());

        // Verbs being learned first (most recently played on top), then the ones only saved so far.
        var list = started
            .Select(v => new MyVerb(v.Lemma, v.Title, v.Translation, v.Level, true, saved.GetValueOrDefault(v.Lemma, new List<VerbFormHit>())))
            .Concat(saved
                .Where(s => !levels.ContainsKey(s.Key))
                .Select(s => new MyVerb(s.Key, s.Value[0].Title, s.Value[0].Translation, VerbLevel.New, false, s.Value)))
            .ToList();
        return new MyVerbs(byEntry, list);
    }

    /// <summary>
    /// The verb to offer on the dashboard: the most recently played one that is not learned yet.
    /// Null when the learner has started none (or learned them all).
    /// </summary>
    public async Task<MyVerb?> ContinueAsync(Guid userId, CancellationToken ct)
    {
        var verb = await dbContext.UserVerbs
            .AsNoTracking()
            .Where(v => v.UserId == userId && v.ExamPassedAtUtc == null)
            .OrderByDescending(v => v.LastPlayedAtUtc ?? v.StartedAtUtc)
            .Select(v => new { v.Verb.Lemma, v.Verb.Title, v.Verb.Translation, v.Level })
            .FirstOrDefaultAsync(ct);
        return verb == null ? null : new MyVerb(verb.Lemma, verb.Title, verb.Translation, verb.Level, true, new List<VerbFormHit>());
    }

    /// <summary>
    /// The verb form in a dictionary entry and whether the entry is that form alone. The Georgian
    /// side may be stored as the word or as the definition, depending on which way it was translated.
    /// </summary>
    public static (VerbFormHit Hit, bool Single)? Find(
        string word, string definition, IReadOnlyDictionary<string, VerbFormHit> hits)
    {
        if (hits.TryGetValue(word, out var hit))
        {
            return (hit, word.Trim() == hit.Form);
        }

        return hits.TryGetValue(definition, out hit) ? (hit, definition.Trim() == hit.Form) : null;
    }
}
