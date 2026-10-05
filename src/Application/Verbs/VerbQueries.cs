using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

public record VerbSummary(string Lemma, string Title, string Translation, string Kind, string PresentJson);

public record VerbFormHit(string Form, string Lemma, string Title, string Translation, string Tense, int Person);

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
            .Select(v => new VerbSummary(v.Lemma, v.Title, v.Translation, v.Kind, v.PresentJson))
            .ToListAsync(ct);
    }

    /// <summary>The ready-to-serve card JSON, or null when there is no such verb.</summary>
    public async Task<string?> GetCardJsonAsync(string lemma, CancellationToken ct)
    {
        return await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Lemma == lemma)
            .Select(v => v.CardJson)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// For each given text (a vocabulary word or phrase) finds the first Georgian word in it that is
    /// a known verb form. One query for the whole batch; texts without a verb are absent from the result.
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
            .Where(f => words.Contains(f.Form))
            .OrderBy(f => f.Verb.SortOrder)
            .ThenBy(f => f.Person)
            .Select(f => new VerbFormHit(f.Form, f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Tense, f.Person))
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
            .Where(f => f.Form == normalized)
            .OrderBy(f => f.Verb.SortOrder)
            .ThenBy(f => f.Person)
            .Select(f => new VerbFormHit(f.Form, f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Tense, f.Person))
            .ToListAsync(ct);
    }
}
