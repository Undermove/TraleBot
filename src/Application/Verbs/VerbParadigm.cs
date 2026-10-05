using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Application.Verbs;

/// <summary>
/// A verb's conjugation as taken from a source: tense → six persons → variants of the form.
/// The same shape as an entry of <c>scripts/verbs/verbs.raw.json</c>.
/// </summary>
/// <param name="Lemma">Dictionary form (3rd person singular present).</param>
/// <param name="Masdar">Verbal noun(s), with and without a preverb; may be empty.</param>
/// <param name="Alt">Parallel tables of the same verb with another preverb.</param>
/// <param name="Source">Page the forms were taken from; null when a model produced them.</param>
public record VerbParadigm(
    string Lemma,
    IReadOnlyList<string> Masdar,
    IReadOnlyDictionary<string, string[][]> Tenses,
    IReadOnlyList<IReadOnlyDictionary<string, string[][]>> Alt,
    string? Source,
    long? Revid)
{
    /// <summary>One Georgian word, Georgian letters only — what a form, a lemma or a masdar must look like.</summary>
    public static readonly Regex GeorgianWord = new("^[ა-ჰ]+$", RegexOptions.Compiled);

    public const int MaxFormLength = 64;

    /// <summary>Of a "with preverb / without" pair the short masdar is the title, as in the catalog.</summary>
    public string Title => Masdar.Count > 0 ? Masdar.OrderBy(m => m.Length).First() : Lemma;

    public IEnumerable<string> AllForms() =>
        Alt.Prepend(Tenses).SelectMany(t => t.Values).SelectMany(persons => persons).SelectMany(variants => variants);

    /// <summary>Whether the word is this verb: its lemma, a masdar or any form of any of its tables.</summary>
    public bool Contains(string word) => word == Lemma || Masdar.Contains(word) || AllForms().Contains(word);
}
