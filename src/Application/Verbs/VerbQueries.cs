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
public record VerbFormHit(
    string Form, string Lemma, string Title, string Translation, string Tense, int Person,
    string? Meaning = null, string? MeaningNote = null);

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

    private static readonly JsonSerializerOptions CardJsonOptions = new()
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
        // A form can belong to several (tense, person) cells; the first by verb order and person wins.
        var byForm = hits.GroupBy(h => h.Form).ToDictionary(g => g.Key, g => g.First());

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
