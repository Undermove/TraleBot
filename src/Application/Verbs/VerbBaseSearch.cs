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

/// <param name="Match">
/// "form" | "masdar" | "translation" — exact; "meaning" — a Russian form matched by the stored phrase;
/// "typo" | "similar" — a guess the caller must confirm.
/// </param>
/// <param name="Form">The verb form that matched, with its tense and person; null when the verb itself matched.</param>
public record VerbBaseMatch(
    string Lemma,
    string Title,
    string Translation,
    VerbStatus Status,
    string Match,
    string? Form = null,
    string? Tense = null,
    int? Person = null,
    string? Meaning = null,
    string? MeaningNote = null);

/// <summary>
/// Looks a word up in the verb base (<c>Verbs</c> / <c>VerbForms</c>). The exact lookup answers a
/// translation request without any model; the loose one is the tool the analysis agent searches the
/// base with: a Georgian form with a typo, or a Russian word in another form («ходил» → «ходить»).
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbBaseSearch(ITraleDbContext dbContext)
{
    private const int MaxResults = 5;

    /// <summary>«мне надо было бы идти» is the longest a single verb form gets; longer texts are sentences.</summary>
    private const int MaxPhraseWords = 5;

    // For a bare Russian past the process («долго или часто») is the natural reading of an imperfective
    // verb, so the imperfect goes before the aorist.
    private static readonly string[] PhraseTenseOrder = ["present", "imperfect", "aorist", "future", "conditional", "optative"];

    /// <summary>Shorter Georgian words are too close to each other for "one letter off" to mean anything.</summary>
    private const int MinTypoLength = 4;

    /// <summary>The verb stored under this dictionary form, if any.</summary>
    public Task<VerbBaseMatch?> FindByLemmaAsync(string lemma, CancellationToken ct)
    {
        return dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Lemma == lemma)
            .Select(v => new VerbBaseMatch(v.Lemma, v.Title, v.Translation, v.Status, "lemma", null, null, null, null, null))
            .FirstOrDefaultAsync(ct);
    }

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

    /// <summary>
    /// A Russian verb form («ходил», «она шла», «мы будем писать») answered from the plain-Russian
    /// meanings stored with the catalog forms. The first match is the answer; the rest are the other
    /// readings of the same text in the same verb (another tense with the same Russian phrase).
    /// Verbs go in catalog order, tenses in the order a learner meets them.
    /// </summary>
    private async Task<IReadOnlyList<VerbBaseMatch>> FindByRussianPhraseAsync(string query, CancellationToken ct)
    {
        if (query.Length > VerbParadigm.MaxFormLength || query.Split(' ').Length > MaxPhraseWords
            || !query.Any(c => c is >= 'а' and <= 'я'))
        {
            return [];
        }

        var asked = VerbMeaningPhrases.Parse(query);
        var core = VerbMeaningPhrases.SearchCore(asked);
        if (core.Length < 2)
        {
            return [];
        }

        // The database narrows to the cells whose phrase has the word; the exact comparison (pronoun,
        // gender variants) is done here.
        var cells = await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => f.Meaning != null && f.Meaning.ToLower().Replace("ё", "е").Contains(core))
            .Select(f => new
            {
                f.Verb.SortOrder, f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status,
                f.Tense, f.Person, f.Meaning, f.MeaningNote
            })
            .Distinct()
            .ToListAsync(ct);

        var readings = cells
            .Where(c => VerbMeaningPhrases.Matches(asked, c.Meaning!))
            .GroupBy(c => (c.SortOrder, c.Lemma, c.Tense))
            .Select(g => (Cells: g.ToList(), Person: VerbMeaningPhrases.PickPerson(asked, g.Select(c => c.Person).Distinct().ToList())))
            .Where(g => g.Person != null)
            .OrderBy(g => g.Cells[0].SortOrder)
            .ThenBy(g => g.Cells[0].Lemma)
            .ThenBy(g => Array.IndexOf(PhraseTenseOrder, g.Cells[0].Tense) is >= 0 and var i ? i : int.MaxValue)
            .ToList();
        if (readings.Count == 0)
        {
            return [];
        }

        // One verb only: the most common one that has the phrase.
        var lemma = readings[0].Cells[0].Lemma;
        var card = await dbContext.Verbs.AsNoTracking().Where(v => v.Lemma == lemma).Select(v => v.CardJson).FirstAsync(ct);
        var tenses = JsonNode.Parse(card)?["tenses"];
        var matches = new List<VerbBaseMatch>();
        foreach (var (group, person) in readings.Where(r => r.Cells[0].Lemma == lemma))
        {
            var cell = group[0];
            // The form of the main table: forms of the parallel tables (other preverbs) share the phrase.
            var form = (tenses?[cell.Tense]?[person!.Value] as JsonArray)?.FirstOrDefault()?.GetValue<string>();
            if (form == null)
            {
                continue;
            }

            // The phrase of the chosen person, when the base has it («она ходила» → the "he" cell).
            var meaning = cells.FirstOrDefault(c => c.Lemma == lemma && c.Tense == cell.Tense && c.Person == person)?.Meaning
                          ?? cell.Meaning;
            matches.Add(new VerbBaseMatch(
                cell.Lemma, cell.Title, cell.Translation, cell.Status, "meaning", form, cell.Tense, person, meaning, cell.MeaningNote));
        }

        return matches;
    }

    /// <summary>
    /// Every exact reading of the query, best first: the verbs a Georgian form or masdar belongs to, the
    /// verbs a Russian gloss translates, or — for a Russian form — the cells of the most common verb whose
    /// stored phrase is the query ("meaning"; see <see cref="FindByRussianPhraseAsync"/>).
    /// </summary>
    public async Task<IReadOnlyList<VerbBaseMatch>> FindAllExactAsync(string query, CancellationToken ct)
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
                f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status, "form", f.Form, f.Tense, f.Person, f.Meaning, f.MeaningNote))
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
        var verbs = candidates.Where(v => RussianParts(v.Translation).Contains(text)).Take(MaxResults).ToList();
        // Not a gloss: a Russian form («ходил», «я иду») is matched by the phrases stored with the forms.
        return verbs.Count > 0 ? verbs : await FindByRussianPhraseAsync(text, ct);
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
                f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status, "typo", f.Form, f.Tense, f.Person, f.Meaning, f.MeaningNote))
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
