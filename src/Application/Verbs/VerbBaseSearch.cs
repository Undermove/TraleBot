using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <param name="Match">"form" | "masdar" | "translation" | "meaning" — exact; "typo" | "similar" — a guess the caller must confirm.</param>
/// <param name="Meaning">What the matched form says in plain Russian («я писал(а)»), when the base has it.</param>
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
    string? Meaning = null);

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
                f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status, "form", f.Form, f.Tense, f.Person, f.Meaning))
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
        return verbs.Count > 0 ? verbs : await FindRussianFormAsync(text, ct);
    }

    /// <summary>Which person answers a Russian form said without a pronoun: «ходил» is «он ходил» first.</summary>
    private static readonly int[] PersonPreference = [2, 5, 0, 1, 3, 4];

    /// <summary>
    /// The same Russian words stand for two Georgian tenses («я писал(а)» is both the long past and the
    /// one-off past, told apart only by a note). The phrases are built from the imperfective Russian
    /// verb, so of the two the long past is the honest match.
    /// </summary>
    private static readonly string[] TensePreference = ["present", "imperfect", "aorist", "future", "conditional", "optative"];

    private static readonly HashSet<string> Pronouns =
        ["я", "ты", "он", "она", "оно", "мы", "вы", "они", "мне", "тебе", "ему", "ей", "нам", "вам", "им"];

    /// <summary>
    /// A Russian inflected form — «ходил», «я иду», «мне надо писать» — found among the plain-Russian
    /// phrases the catalog stores for every form (<see cref="VerbForm.Meaning"/>). No model is involved:
    /// the phrase was built from the verb's translation when the catalog was built.
    /// With a pronoun the match is exact; without one several persons fit and the most usual is returned.
    /// </summary>
    private async Task<IReadOnlyList<VerbBaseMatch>> FindRussianFormAsync(string text, CancellationToken ct)
    {
        // The database narrows by the start of the verb word («пис» for «я писала»): the stored phrase
        // «я писал(а)» does not contain the text itself. The exact comparison is done on the variants here.
        var lastWord = text[(text.LastIndexOf(' ') + 1)..];
        var stem = lastWord[..Math.Min(3, lastWord.Length)];
        var rows = await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => f.Meaning != null && f.Meaning.ToLower().Replace("ё", "е").Contains(stem))
            .OrderBy(f => f.Verb.SortOrder)
            .ThenBy(f => f.Verb.Lemma)
            .Select(f => new VerbBaseMatch(
                f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status, "meaning", f.Form, f.Tense, f.Person, f.Meaning))
            .ToListAsync(ct);

        return rows
            .Select(m => (Match: m, Fit: FitOf(text, m.Meaning!)))
            .Where(x => x.Fit > 0)
            .GroupBy(x => x.Match.Lemma)
            // Per verb: a phrase that matches with its pronoun beats one that matches without; then the
            // usual person and the honest tense. Verbs keep the catalog order (GroupBy preserves it).
            .Select(g => g
                .OrderByDescending(x => x.Fit)
                .ThenBy(x => Rank(PersonPreference, x.Match.Person ?? 0))
                .ThenBy(x => Rank(TensePreference, x.Match.Tense ?? string.Empty))
                .First().Match)
            .Take(MaxResults)
            .ToList();
    }

    /// <summary>2 — the text is the whole phrase; 1 — the phrase without its pronoun; 0 — not this phrase.</summary>
    private static int FitOf(string text, string meaning)
    {
        var fit = 0;
        foreach (var variant in MeaningVariants(meaning))
        {
            if (variant == text)
            {
                return 2;
            }

            var space = variant.IndexOf(' ');
            if (space > 0 && Pronouns.Contains(variant[..space]) && variant[(space + 1)..] == text)
            {
                fit = 1;
            }
        }

        return fit;
    }

    /// <summary>
    /// Every way a stored phrase can be said: «я писал(а)» → «я писал», «я писала»;
    /// «я шёл / шла» → «я шел», «я шла». Lower-cased, «ё» as «е» — the way a looked-up text is normalised.
    /// </summary>
    internal static IEnumerable<string> MeaningVariants(string meaning)
    {
        var phrase = meaning.Trim().ToLowerInvariant().Replace('ё', 'е');
        if (phrase.Contains(" / "))
        {
            var parts = phrase.Split(" / ");
            var head = parts[0][..(parts[0].LastIndexOf(' ') + 1)];
            yield return parts[0];
            foreach (var other in parts.Skip(1))
            {
                yield return head + other;
            }
        }
        else if (phrase.Contains("(а)"))
        {
            yield return phrase.Replace("(а)", string.Empty);
            yield return phrase.Replace("(а)", "а");
        }
        else
        {
            yield return phrase;
        }
    }

    private static int Rank<T>(T[] order, T value)
    {
        var at = Array.IndexOf(order, value);
        return at < 0 ? order.Length : at;
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
