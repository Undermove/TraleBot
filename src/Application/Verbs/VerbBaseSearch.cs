using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <param name="Match">"form" | "masdar" | "translation" — exact; "typo" | "similar" — a guess the caller must confirm.</param>
/// <param name="Form">The verb form that matched, with its tense and person; null when the verb itself matched.</param>
public record VerbBaseMatch(
    string Lemma,
    string Title,
    string Translation,
    VerbStatus Status,
    string Match,
    string? Form = null,
    string? Tense = null,
    int? Person = null);

/// <summary>
/// Looks a word up in the verb base (<c>Verbs</c> / <c>VerbForms</c>). The exact lookup answers a
/// translation request without any model; the loose one is the tool the analysis agent searches the
/// base with: a Georgian form with a typo, or a Russian word in another form («ходил» → «ходить»).
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbBaseSearch(ITraleDbContext dbContext)
{
    private const int MaxResults = 5;

    /// <summary>Shorter Georgian words are too close to each other for "one letter off" to mean anything.</summary>
    private const int MinTypoLength = 4;

    /// <summary>The verb an exact form, masdar or translation belongs to; of several, the most common one.</summary>
    /// <param name="query">A <see cref="Translation.Cache.TranslationCacheKey"/>-normalised word or phrase.</param>
    public async Task<VerbBaseMatch?> FindExactAsync(string query, CancellationToken ct)
    {
        return (await FindAllExactAsync(query, ct)).FirstOrDefault();
    }

    /// <summary>
    /// What the agent's tool returns. Every verb the query exactly is (one form can belong to several
    /// verbs, one Russian word can translate several); only when there is none — the loose guesses.
    /// At most <see cref="MaxResults"/>, best first: the catalog is ordered by how common a verb is.
    /// </summary>
    public async Task<IReadOnlyList<VerbBaseMatch>> SearchAsync(string query, CancellationToken ct)
    {
        var exact = await FindAllExactAsync(query, ct);
        if (exact.Count > 0 || query.Length > VerbParadigm.MaxFormLength)
        {
            return exact;
        }

        return VerbParadigm.GeorgianWord.IsMatch(query)
            ? await FindGeorgianTyposAsync(query, ct)
            : await FindRussianSimilarAsync(query, ct);
    }

    private async Task<IReadOnlyList<VerbBaseMatch>> FindAllExactAsync(string query, CancellationToken ct)
    {
        if (query.Length > VerbParadigm.MaxFormLength)
        {
            return [];
        }

        return VerbParadigm.GeorgianWord.IsMatch(query)
            ? await FindGeorgianAsync(query, ct)
            : await FindRussianAsync(query, ct);
    }

    private async Task<IReadOnlyList<VerbBaseMatch>> FindGeorgianAsync(string word, CancellationToken ct)
    {
        // A form can sit in several (tense, person) cells and in several verbs. Per verb the first
        // cell by person wins, as in VerbQueries.FindInTextsAsync; verbs go by catalog order.
        var byForm = await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => f.Form == word)
            .OrderBy(f => f.Verb.SortOrder)
            .ThenBy(f => f.Verb.Lemma)
            .ThenBy(f => f.Person)
            .Select(f => new VerbBaseMatch(
                f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status, "form", f.Form, f.Tense, f.Person))
            .ToListAsync(ct);
        if (byForm.Count > 0)
        {
            return byForm.GroupBy(m => m.Lemma).Select(g => g.First()).Take(MaxResults).ToList();
        }

        return await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Title == word)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Lemma)
            .Take(MaxResults)
            .Select(v => new VerbBaseMatch(v.Lemma, v.Title, v.Translation, v.Status, "masdar", null, null, null))
            .ToListAsync(ct);
    }

    private async Task<IReadOnlyList<VerbBaseMatch>> FindRussianAsync(string text, CancellationToken ct)
    {
        // "есть, кушать" answers both «есть» and «кушать», but not «кушать суп»; a gloss with a
        // clarification — «входить (сюда)» — is another verb and does not answer plain «входить».
        var candidates = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Translation.ToLower().Replace("ё", "е").Contains(text))
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Lemma)
            .Select(v => new VerbBaseMatch(v.Lemma, v.Title, v.Translation, v.Status, "translation", null, null, null))
            .ToListAsync(ct);
        return candidates.Where(v => RussianParts(v.Translation).Contains(text)).Take(MaxResults).ToList();
    }

    private async Task<IReadOnlyList<VerbBaseMatch>> FindGeorgianTyposAsync(string word, CancellationToken ct)
    {
        if (word.Length < MinTypoLength)
        {
            return [];
        }

        // One edit away means the length differs by at most one — the database narrows by that,
        // the distance itself is counted here.
        var min = word.Length - 1;
        var max = word.Length + 1;
        var candidates = await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => f.Form.Length >= min && f.Form.Length <= max)
            .OrderBy(f => f.Verb.SortOrder)
            .ThenBy(f => f.Verb.Lemma)
            .ThenBy(f => f.Person)
            .Select(f => new VerbBaseMatch(
                f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status, "typo", f.Form, f.Tense, f.Person))
            .ToListAsync(ct);

        return candidates
            .Where(c => IsOneEditAway(word, c.Form!))
            .GroupBy(c => c.Lemma)
            .Select(g => g.First())
            .Take(MaxResults)
            .ToList();
    }

    private async Task<IReadOnlyList<VerbBaseMatch>> FindRussianSimilarAsync(string text, CancellationToken ct)
    {
        var verbs = await dbContext.Verbs
            .AsNoTracking()
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Lemma)
            .Select(v => new VerbBaseMatch(v.Lemma, v.Title, v.Translation, v.Status, "similar", null, null, null))
            .ToListAsync(ct);

        // The longer the shared start, the better the guess; among equals a gloss without a
        // clarification first, then the more common verb (the list is already in catalog order).
        return verbs
            .Select(v => (Verb: v, Best: RussianParts(v.Translation)
                .Select(part => (Shared: SharedStem(text, WithoutClarification(part)), Plain: !part.Contains('(')))
                .DefaultIfEmpty()
                .Max()))
            .Where(x => x.Best.Shared > 0)
            .OrderByDescending(x => x.Best.Shared)
            .ThenByDescending(x => x.Best.Plain)
            .Select(x => x.Verb)
            .Take(MaxResults)
            .ToList();
    }

    private static string WithoutClarification(string part)
    {
        var bracket = part.IndexOf('(');
        return bracket < 0 ? part : part[..bracket].TrimEnd();
    }

    private static IEnumerable<string> RussianParts(string translation) =>
        translation.ToLowerInvariant().Replace('ё', 'е').Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

    /// <summary>
    /// «ходил» and «ходить» share everything but the ending. Deliberately crude: it only has to offer
    /// candidates to the agent, which decides; suppletive pairs («шёл» — «идти») are for the agent to
    /// ask about by their infinitive.
    /// </summary>
    /// <returns>Length of the shared start when it is long enough to mean the same stem, else 0.</returns>
    private static int SharedStem(string a, string b)
    {
        var common = 0;
        while (common < a.Length && common < b.Length && a[common] == b[common])
        {
            common++;
        }

        return common >= 3 && common >= Math.Min(a.Length, b.Length) - 2 ? common : 0;
    }

    /// <summary>One substitution, insertion or deletion.</summary>
    private static bool IsOneEditAway(string a, string b)
    {
        if (a == b || Math.Abs(a.Length - b.Length) > 1)
        {
            return false;
        }

        var (shorter, longer) = a.Length <= b.Length ? (a, b) : (b, a);
        var i = 0;
        while (i < shorter.Length && shorter[i] == longer[i])
        {
            i++;
        }

        return shorter.Length == longer.Length
            ? shorter.AsSpan(i + 1).SequenceEqual(longer.AsSpan(i + 1))
            : shorter.AsSpan(i).SequenceEqual(longer.AsSpan(i + 1));
    }
}
