using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <param name="Due">Forms of this verb that are due for repetition now.</param>
public record SectionVerb(string Lemma, string Title, string Translation, VerbLevel Level, int Due);

public record SectionPack(string Id, string Title, IReadOnlyList<SectionVerb> Verbs);

public record SectionLevel(int Id, string Title, IReadOnlyList<SectionPack> Packs);

/// <summary>One of the learner's own verbs: saved in the dictionary (from the bot or the mini-app), started in play, or both.</summary>
/// <param name="Generated">The record was written by a model (<see cref="VerbStatus.Generated"/>), not taken from the curated catalog.</param>
/// <param name="LevelId">The ladder level the verb also sits in; null for a verb outside the ladder.</param>
public record SectionMyVerb(string Lemma, string Title, string Translation, VerbLevel Level, bool Generated, int? LevelId, string? PackId);

/// <summary>What the section offers to do now — the one big card.</summary>
/// <param name="Kind"><see cref="VerbSectionQuery.Continue"/>, <see cref="VerbSectionQuery.Review"/> or <see cref="VerbSectionQuery.New"/>.</param>
public record SectionNext(
    string Kind, string Lemma, string Title, string Translation, VerbLevel Level, int Due, int? LevelId, string? PackId, string? PackTitle);

/// <param name="Total">Verbs in the ladder.</param>
/// <param name="CurrentLevelId">The level to show expanded: where the "what now" verb is, else the first unfinished one.</param>
/// <param name="Examples">Russian infinitives of catalog verbs the learner does not have yet — examples for "type any verb".</param>
/// <param name="AlphabetHint">The learner is a beginner who has not finished the alphabet module.</param>
public record VerbSection(
    int Total,
    int Learned,
    IReadOnlyList<SectionLevel> Levels,
    SectionNext? Next,
    int CurrentLevelId,
    IReadOnlyList<SectionMyVerb> MyVerbs,
    IReadOnlyList<string> Examples,
    bool AlphabetHint);

/// <summary>
/// The «Глаголы» section in one read: the ladder (levels → packs → verbs) with this learner's
/// level of every verb, the learner's own verbs, and what to do now. A fixed handful of queries
/// whatever the size of the catalog — no per-verb queries.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbSectionQuery(
    ITraleDbContext dbContext,
    VerbLevelCatalog catalog,
    VerbQueries verbs,
    IProgressCalculator progressCalculator)
{
    public const string Continue = "continue";
    public const string Review = "review";
    public const string New = "new";

    public const int ExampleCount = 3;

    private record StartedVerb(string Lemma, string Title, string Translation, VerbStatus Status, VerbLevel Level);

    public async Task<VerbSection> GetAsync(User user, int alphabetLessons, DateTime now, CancellationToken ct)
    {
        var lemmas = catalog.Lemmas;
        var curated = (await dbContext.Verbs
                .AsNoTracking()
                .Where(v => lemmas.Contains(v.Lemma))
                .Select(v => new { v.Lemma, v.Title, v.Translation })
                .ToListAsync(ct))
            .ToDictionary(v => v.Lemma);

        // Most recently played first — this order is "the verb in progress".
        var started = await dbContext.UserVerbs
            .AsNoTracking()
            .Where(v => v.UserId == user.Id)
            .OrderByDescending(v => v.LastPlayedAtUtc ?? v.StartedAtUtc)
            .Select(v => new StartedVerb(v.Verb.Lemma, v.Verb.Title, v.Verb.Translation, v.Verb.Status, v.Level))
            .ToListAsync(ct);
        var levelOf = started.ToDictionary(v => v.Lemma, v => v.Level);

        var due = (await dbContext.VerbFormProgresses
                .AsNoTracking()
                .Where(p => p.UserId == user.Id && p.NextDueAtUtc != null && p.NextDueAtUtc <= now)
                .GroupBy(p => p.Verb.Lemma)
                .Select(g => new { Lemma = g.Key, Count = g.Count() })
                .ToListAsync(ct))
            .ToDictionary(d => d.Lemma, d => d.Count);

        SectionVerb Row(string lemma) => new(
            lemma, curated[lemma].Title, curated[lemma].Translation,
            levelOf.GetValueOrDefault(lemma, VerbLevel.New), due.GetValueOrDefault(lemma));

        // A verb of the plan that is not in the base (the catalog was not seeded) is simply not shown.
        var levels = catalog.Levels
            .Select(level => new SectionLevel(level.Id, level.Title, level.Packs
                .Select(pack => new SectionPack(pack.Id, pack.Title, pack.Verbs.Where(curated.ContainsKey).Select(Row).ToList()))
                .Where(pack => pack.Verbs.Count > 0)
                .ToList()))
            .Where(level => level.Packs.Count > 0)
            .ToList();

        var myVerbs = await MyVerbsAsync(user, started, ct);
        var next = PickNext(levels, started.Select(v => (v.Lemma, v.Title, v.Translation, v.Level)).ToList(), due, catalog);
        var ladder = levels.SelectMany(l => l.Packs).SelectMany(p => p.Verbs).ToList();

        return new VerbSection(
            ladder.Count,
            ladder.Count(v => v.Level == VerbLevel.Learned),
            levels,
            next,
            next?.LevelId
                ?? levels.FirstOrDefault(l => l.Packs.Any(p => p.Verbs.Any(v => v.Level != VerbLevel.Learned)))?.Id
                ?? levels.LastOrDefault()?.Id
                ?? 0,
            myVerbs,
            PickExamples(levels, myVerbs.Select(v => v.Lemma).ToHashSet()),
            await NeedsAlphabetAsync(user, alphabetLessons, ct));
    }

    /// <summary>
    /// What to do now. The verb in progress comes first (the most recently played one that is not
    /// learned yet), then a verb with forms due for repetition, then the next untouched verb of the
    /// ladder. Null when every verb is learned and nothing is due.
    /// </summary>
    public static SectionNext? PickNext(
        IReadOnlyList<SectionLevel> levels,
        IReadOnlyList<(string Lemma, string Title, string Translation, VerbLevel Level)> startedRecentFirst,
        IReadOnlyDictionary<string, int> due,
        VerbLevelCatalog catalog)
    {
        var packs = levels.SelectMany(l => l.Packs).ToDictionary(p => p.Id);
        SectionNext Make(string kind, string lemma, string title, string translation, VerbLevel level)
        {
            var place = catalog.PlaceOf(lemma);
            var pack = place != null && packs.TryGetValue(place.PackId, out var found) ? found : null;
            return new SectionNext(
                kind, lemma, title, translation, level, due.GetValueOrDefault(lemma), pack == null ? null : place!.LevelId, pack?.Id, pack?.Title);
        }

        var inProgress = startedRecentFirst.Where(v => v.Level != VerbLevel.Learned).Select(v => (v.Lemma, v.Title, v.Translation, v.Level)).FirstOrDefault();
        if (inProgress.Lemma != null)
        {
            return Make(Continue, inProgress.Lemma, inProgress.Title, inProgress.Translation, inProgress.Level);
        }

        var toReview = startedRecentFirst
            .Where(v => due.GetValueOrDefault(v.Lemma) > 0)
            .OrderByDescending(v => due[v.Lemma])
            .Select(v => (v.Lemma, v.Title, v.Translation, v.Level))
            .FirstOrDefault();
        if (toReview.Lemma != null)
        {
            return Make(Review, toReview.Lemma, toReview.Title, toReview.Translation, toReview.Level);
        }

        var startedLemmas = startedRecentFirst.Select(v => v.Lemma).ToHashSet();
        var fresh = levels.SelectMany(l => l.Packs).SelectMany(p => p.Verbs).FirstOrDefault(v => !startedLemmas.Contains(v.Lemma));
        return fresh == null ? null : Make(New, fresh.Lemma, fresh.Title, fresh.Translation, VerbLevel.New);
    }

    /// <summary>
    /// "My verbs" = verbs the learner has started ∪ verbs whose forms are in their dictionary —
    /// started ones first, most recent on top. A verb that also sits in the ladder is listed here
    /// too (and shown as started in its level): it is not a second copy, only a second way to it.
    /// </summary>
    private async Task<IReadOnlyList<SectionMyVerb>> MyVerbsAsync(User user, IReadOnlyList<StartedVerb> started, CancellationToken ct)
    {
        var entries = await dbContext.VocabularyEntries
            .AsNoTracking()
            .Where(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage)
            .OrderByDescending(v => v.DateAddedUtc)
            .Select(v => new { v.Word, v.Definition })
            .ToListAsync(ct);
        var hits = entries.Count == 0
            ? new Dictionary<string, VerbFormHit>()
            : await verbs.FindInTextsAsync(entries.SelectMany(e => new[] { e.Word, e.Definition }).ToList(), ct);

        var startedLemmas = started.Select(v => v.Lemma).ToHashSet();
        var saved = entries
            .Select(e => MyVerbsQuery.Find(e.Word, e.Definition, hits)?.Hit)
            .Where(hit => hit != null && !startedLemmas.Contains(hit.Lemma))
            .DistinctBy(hit => hit!.Lemma)
            .ToList();

        // Only verbs outside the ladder can be model-made; ask their status in one query.
        var outside = saved.Select(h => h!.Lemma).Where(l => catalog.PlaceOf(l) == null).ToList();
        var generated = outside.Count == 0
            ? new HashSet<string>()
            : (await dbContext.Verbs
                .AsNoTracking()
                .Where(v => outside.Contains(v.Lemma) && v.Status == VerbStatus.Generated)
                .Select(v => v.Lemma)
                .ToListAsync(ct)).ToHashSet();

        SectionMyVerb Mine(string lemma, string title, string translation, VerbLevel level, bool modelMade)
        {
            var place = catalog.PlaceOf(lemma);
            return new SectionMyVerb(lemma, title, translation, level, modelMade, place?.LevelId, place?.PackId);
        }

        return started
            .Select(v => Mine(v.Lemma, v.Title, v.Translation, v.Level, v.Status == VerbStatus.Generated))
            .Concat(saved.Select(h => Mine(h!.Lemma, h.Title, h.Translation, VerbLevel.New, generated.Contains(h.Lemma))))
            .ToList();
    }

    /// <summary>
    /// Examples for "type any verb in Russian": one-word glosses of ladder verbs the learner does
    /// not have yet, one per pack, starting after the first level (those verbs come by themselves).
    /// </summary>
    private static IReadOnlyList<string> PickExamples(IReadOnlyList<SectionLevel> levels, IReadOnlySet<string> mine)
    {
        static bool OneWord(string gloss) => gloss.Length > 0 && gloss.All(char.IsLetter);

        var perPack = levels
            .OrderBy(l => l.Id == 1)
            .SelectMany(l => l.Packs)
            .Select(p => p.Verbs.FirstOrDefault(v => !mine.Contains(v.Lemma) && OneWord(v.Translation))?.Translation)
            .Where(gloss => gloss != null)
            .Select(gloss => gloss!)
            .Distinct()
            .Take(ExampleCount)
            .ToList();
        return perPack;
    }

    /// <summary>Same rule as "may be asked to type" in <see cref="VerbLearningService"/>, turned around.</summary>
    private async Task<bool> NeedsAlphabetAsync(User user, int alphabetLessons, CancellationToken ct)
    {
        if (alphabetLessons <= 0)
        {
            return false;
        }

        var miniApp = await dbContext.MiniAppUserProgresses.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id, ct);
        if (miniApp?.Level == LearningConstants.Levels.Intermediate)
        {
            return false;
        }

        return miniApp == null || progressCalculator.CompletedLessons(miniApp, LearningConstants.Modules.Alphabet) < alphabetLessons;
    }
}
