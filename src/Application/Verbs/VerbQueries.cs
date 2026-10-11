using System.Collections.Generic;
using System.Linq;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

public record VerbSummary(
    string Lemma, string Title, string Translation, string Kind, string PresentJson, VerbStatus Status = VerbStatus.Verified);

/// <param name="Meaning">The form in plain Russian («я хотел(а)»); null when the base has no phrase for it.</param>
/// <param name="MeaningNote">Tells apart tenses with the same phrase («один раз · сделано»); usually null.</param>
/// <param name="ActionName">
/// Not a form: a dictionary entry that is the name of the verb's action («делать» — the card title).
/// <c>Form</c> is then that name, <c>Meaning</c> says so, and tense / person point at the dictionary form.
/// </param>
public record VerbFormHit(
    string Form, string Lemma, string Title, string Translation, string Tense, int Person,
    string? Meaning = null, string? MeaningNote = null, bool ActionName = false);

/// <summary>
/// Read side of the "Глаголы" section: the list, one card, and the parse of a pasted form.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbQueries(ITraleDbContext dbContext)
{
    /// <summary>Longest Georgian verb form is far below this; anything longer is not a single word.</summary>
    private const int MaxFormLength = 64;

    private static readonly Regex GeorgianWord = new("[ა-ჰ]+", RegexOptions.Compiled);

    public async Task<IReadOnlyList<VerbSummary>> ListAsync(CancellationToken ct)
    {
        return await dbContext.Verbs
            .AsNoTracking()
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Lemma)
            .Select(v => new VerbSummary(v.Lemma, v.Title, v.Translation, v.Kind, v.PresentJson, v.Status))
            .ToListAsync(ct);
    }

    /// <summary>The ready-to-serve card JSON, or null when there is no such verb.</summary>
    public async Task<string?> GetCardJsonAsync(string lemma, CancellationToken ct)
    {
        var row = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Lemma == lemma)
            .Select(v => new { v.CardJson, v.Status })
            .FirstOrDefaultAsync(ct);

        return row == null ? null : WithStatus(row.CardJson, row.Status);
    }

    /// <summary>
    /// Adds <c>status</c> ("verified" / "generated") to the stored card. It is taken from the column at
    /// serving time, not baked into the stored JSON, so the mini-app can never see a stale value. A
    /// generated verb (written by a model, approved by a second one) is shown and learned like any
    /// other; the card only says quietly where it came from.
    /// </summary>
    private static string WithStatus(string cardJson, VerbStatus status)
    {
        var card = JsonNode.Parse(cardJson)!.AsObject();
        card["status"] = RuntimeVerbStore.StatusName(status);
        // Tenses of a model-made verb that nothing confirms leave "tenses": the card shows them apart,
        // marked, and nothing that teaches or examines can pick them up.
        return VerbVerification.ForLearners(card).ToJsonString(CardJsonOptions);
    }

    internal static readonly JsonSerializerOptions CardJsonOptions = new()
    {
        // Same as the seeder: Georgian and Russian stay readable instead of \uXXXX escapes.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>
    /// For each given text (a vocabulary word or phrase) finds the first Georgian word in it that is
    /// a known verb form (an unverified form of a model-made verb is not one: nothing is stated about it). One query for the whole batch; texts without a verb are absent from the result.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, VerbFormHit>> FindInTextsAsync(
        IReadOnlyCollection<string> texts, CancellationToken ct)
    {
        var wordsByText = texts
            .Distinct()
            .ToDictionary(t => t, t => GeorgianWord.Matches(t).Select(m => m.Value).ToList());
        var words = wordsByText.Values.SelectMany(w => w).Distinct().ToList();
        if (words.Count == 0)
        {
            return new Dictionary<string, VerbFormHit>();
        }

        var hits = await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => words.Contains(f.Form) && !f.Unverified)
            .OrderBy(f => f.Verb.SortOrder)
            .ThenBy(f => f.Person)
            .Select(f => new VerbFormHit(
                f.Form, f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Tense, f.Person, f.Meaning, f.MeaningNote))
            .ToListAsync(ct);
        // A form can belong to several verbs and several (tense, person) cells: the first verb by
        // catalog order wins, and of its cells the tense a learner meets first («он был» before
        // «чтобы ты был»), then the person.
        var byForm = hits.GroupBy(h => h.Form).ToDictionary(g => g.Key, BestCell);

        var result = new Dictionary<string, VerbFormHit>();
        foreach (var (text, textWords) in wordsByText)
        {
            var word = textWords.FirstOrDefault(byForm.ContainsKey);
            if (word != null)
            {
                result[text] = byForm[word];
            }
        }

        return result;
    }

    /// <summary>
    /// The verb in each dictionary entry (aligned with <paramref name="entries"/>; null — none) and
    /// whether the entry is that verb's word alone. A known form anywhere in the entry, as in
    /// <see cref="FindInTextsAsync"/>; or — what a verb translated by its Russian infinitive is saved
    /// as — the name of the action on one side and the verb's Russian gloss on the other. The gloss is
    /// required: the name of an action is often an everyday noun too («игра»), and a noun saved as a
    /// noun is not a verb of the learner's.
    /// </summary>
    public async Task<IReadOnlyList<(VerbFormHit Hit, bool Single)?>> FindInEntriesAsync(
        IReadOnlyList<(string Word, string Definition)> entries, CancellationToken ct)
    {
        if (entries.Count == 0)
        {
            return [];
        }

        var hits = await FindInTextsAsync(entries.SelectMany(e => new[] { e.Word, e.Definition }).ToList(), ct);
        var found = entries.Select(e => MyVerbsQuery.Find(e.Word, e.Definition, hits)).ToList();

        var named = entries
            .Select((e, n) => found[n] != null ? null : GeorgianAndRussian(e.Word, e.Definition))
            .ToList();
        var names = named.Where(x => x != null).Select(x => x!.Value.Georgian).Distinct().ToList();
        if (names.Count == 0)
        {
            return found;
        }

        var verbs = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => names.Contains(v.Title) && v.Title != v.Lemma)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Lemma)
            .Select(v => new { v.Lemma, v.Title, v.Translation })
            .ToListAsync(ct);
        for (var n = 0; n < entries.Count && verbs.Count > 0; n++)
        {
            if (named[n] is not var (georgian, russian))
            {
                continue;
            }

            var verb = verbs.FirstOrDefault(v =>
                v.Title == georgian
                && (VerbBaseSearch.RussianParts(v.Translation).Contains(russian)
                    || string.Join(", ", VerbBaseSearch.RussianParts(v.Translation)) == russian));
            if (verb != null)
            {
                found[n] = (new VerbFormHit(
                    verb.Title, verb.Lemma, verb.Title, verb.Translation, "present", 2, VerbCardWording.ActionName, ActionName: true), true);
            }
        }

        return found;
    }

    /// <summary>The two sides of an entry when one of them is a single Georgian word; the Russian one normalised like a gloss.</summary>
    private static (string Georgian, string Russian)? GeorgianAndRussian(string word, string definition)
    {
        var (a, b) = (word.Trim(), definition.Trim());
        var (georgian, other) = VerbParadigm.GeorgianWord.IsMatch(a) ? (a, b) : VerbParadigm.GeorgianWord.IsMatch(b) ? (b, a) : (null, null);
        var russian = Translation.Cache.TranslationCacheKey.Normalize(other);
        return georgian == null || russian == null ? null : (georgian, russian);
    }

    internal static VerbFormHit BestCell(IEnumerable<VerbFormHit> cellsInVerbOrder)
    {
        var cells = cellsInVerbOrder.ToList();
        return cells
            .Where(h => h.Lemma == cells[0].Lemma)
            .OrderBy(h => VerbCardWording.Rank(h.Tense))
            .ThenBy(h => h.Person)
            .First();
    }

    /// <summary>
    /// Every (verb, tense, person) the exact form can be. Empty when the form is unknown —
    /// the caller says "not in the base yet" instead of guessing.
    /// </summary>
    public async Task<IReadOnlyList<VerbFormHit>> ParseAsync(string form, CancellationToken ct)
    {
        var normalized = form.Trim();
        if (normalized.Length == 0 || normalized.Length > MaxFormLength)
        {
            return new List<VerbFormHit>();
        }

        return await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => f.Form == normalized && !f.Unverified)
            .OrderBy(f => f.Verb.SortOrder)
            .ThenBy(f => f.Person)
            .Select(f => new VerbFormHit(
                f.Form, f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Tense, f.Person, f.Meaning, f.MeaningNote))
            .ToListAsync(ct);
    }
}
