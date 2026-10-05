using System.Text.Json;
using System.Text.RegularExpressions;
using Application.Translation.Pipeline;
using Application.Verbs;

namespace Infrastructure.Translation.Wiktionary;

/// <summary>
/// Reads a Georgian verb's conjugation out of an English Wiktionary page, as returned by
/// <c>api.php?action=parse&amp;prop=text|revid|wikitext</c>. A C# port of
/// <c>scripts/verbs/fetch-wiktionary.mjs</c> — the same table is located the same way, so a verb added
/// at runtime looks exactly like a catalog one. Forms are taken only from the table; nothing is built
/// by analogy.
/// </summary>
public static class WiktionaryVerbParser
{
    // Verbs of motion have several tables on the page (different preverbs); which one is the main.
    // Same list as in the script. The other tables are kept as Alt, so the form index finds them too.
    private static readonly Dictionary<string, int> MainTable = new() { ["მიდის"] = 1 };

    private static readonly Dictionary<string, string> Tenses = new()
    {
        ["present"] = "present",
        ["imperfect"] = "imperfect",
        ["present subjunctive"] = "presentSubjunctive",
        ["future"] = "future",
        ["conditional"] = "conditional",
        ["future subjunctive"] = "futureSubjunctive",
        ["aorist"] = "aorist",
        ["optative"] = "optative",
        ["perfect"] = "perfect",
        ["pluperfect"] = "pluperfect",
        ["perfect subjunctive"] = "perfectSubjunctive"
    };

    private static readonly Regex Table = new(@"<table[^>]*roa-inflection-table[\s\S]*?</table>", RegexOptions.Compiled);
    private static readonly Regex RowStart = new("<tr[^>]*>", RegexOptions.Compiled);
    private static readonly Regex HeaderCell = new(@"<th[^>]*>([\s\S]*?)</th>", RegexOptions.Compiled);
    private static readonly Regex DataCell = new(@"<td[^>]*>([\s\S]*?)</td>", RegexOptions.Compiled);
    private static readonly Regex GeorgianSpan = new(@"<span class=""Geor"" lang=""ka"">([\s\S]*?)</span>", RegexOptions.Compiled);
    private static readonly Regex VerbalNounParameter = new(@"\{\{ka-verb[^}]*\|vn=([ა-ჰ]+)", RegexOptions.Compiled);

    /// <returns>Null when the page does not exist, has no Georgian conjugation table, or the table could not be read.</returns>
    public static WiktionaryVerbPage? Parse(string apiResponseJson, string lemma)
    {
        using var document = JsonDocument.Parse(apiResponseJson);
        if (!document.RootElement.TryGetProperty("parse", out var parse))
        {
            return null;
        }

        var html = parse.GetProperty("text").GetString() ?? string.Empty;
        var wikitext = parse.GetProperty("wikitext").GetString() ?? string.Empty;

        var georgian = html.Split("<h2 id=\"Georgian\"").ElementAtOrDefault(1) ?? string.Empty;
        georgian = Regex.Split(georgian, "<h2 ")[0];
        var tables = Table.Matches(georgian).Select(m => m.Value).ToList();
        if (tables.Count == 0)
        {
            return null;
        }

        var main = MainTable.GetValueOrDefault(lemma, 0);
        if (main >= tables.Count)
        {
            return null;
        }

        var (masdar, tenses) = ParseTable(tables[main]);
        if (!tenses.ContainsKey("present") && !tenses.ContainsKey("future"))
        {
            return null;
        }

        var alt = tables.Where((_, i) => i != main)
            .Select(t => (IReadOnlyDictionary<string, string[][]>)ParseTable(t).Tenses)
            .ToList();
        if (masdar == null)
        {
            var verbalNoun = VerbalNounParameter.Match(wikitext);
            masdar = verbalNoun.Success ? [verbalNoun.Groups[1].Value] : [];
        }

        var paradigm = new VerbParadigm(
            lemma,
            masdar,
            tenses,
            alt,
            $"https://en.wiktionary.org/wiki/{Uri.EscapeDataString(lemma)}",
            parse.TryGetProperty("revid", out var revid) ? revid.GetInt64() : null);
        return new WiktionaryVerbPage(paradigm, Glosses(wikitext));
    }

    private static (string[]? Masdar, Dictionary<string, string[][]> Tenses) ParseTable(string table)
    {
        var tenses = new Dictionary<string, string[][]>();
        string[]? masdar = null;
        foreach (var row in RowStart.Split(table).Skip(1))
        {
            var headers = HeaderCell.Matches(row).Select(m => Strip(m.Groups[1].Value)).ToList();
            var cells = DataCell.Matches(row).Select(m => m.Groups[1].Value).ToList();
            if (headers.Contains("verbal noun"))
            {
                var forms = cells.SelectMany(CellForms).ToArray();
                if (forms.Length > 0)
                {
                    masdar = forms;
                }

                continue;
            }

            if (headers.Count == 0 || !Tenses.TryGetValue(headers[^1], out var tense) || cells.Count != 6)
            {
                continue;
            }

            var persons = cells.Select(CellForms).ToArray();
            if (persons.All(p => p.Length == 0))
            {
                continue;
            }

            tenses[tense] = persons;
        }

        return (masdar, tenses);
    }

    /// <summary>Georgian spellings of one cell only; variants separated by "/" or "," are kept as a list.</summary>
    private static string[] CellForms(string cell) =>
        GeorgianSpan.Matches(cell)
            .Select(m => Strip(m.Groups[1].Value))
            .SelectMany(f => f.Split(',', '/'))
            .Select(f => f.Trim())
            .Where(f => VerbParadigm.GeorgianWord.IsMatch(f))
            .ToArray();

    private static string Strip(string html)
    {
        var text = Regex.Replace(html, @"<style[\s\S]*?</style>", string.Empty);
        text = Regex.Replace(text, "<[^>]+>", string.Empty);
        text = text.Replace("&amp;", "&").Replace("&#160;", " ").Replace("&nbsp;", " ");
        return Regex.Replace(text, @"\s+", " ").Trim();
    }

    /// <summary>English senses of the Verb section — what the model reads to make sure it is the right verb.</summary>
    private static List<string> Glosses(string wikitext)
    {
        var section = Regex.Split(wikitext, "^==Georgian==$", RegexOptions.Multiline).ElementAtOrDefault(1) ?? string.Empty;
        section = Regex.Split(section, "^==[^=]", RegexOptions.Multiline)[0];
        var verb = Regex.Split(section, "^===+Verb===+$", RegexOptions.Multiline).ElementAtOrDefault(1) ?? string.Empty;
        verb = Regex.Split(verb, "^===", RegexOptions.Multiline)[0];

        return verb.Split('\n')
            .Where(line => line.StartsWith("# "))
            .Where(line => !Regex.IsMatch(line, @"\{\{(nonstandard|alternative|inflection|form of|ka-verbal)"))
            .Select(line =>
            {
                var gloss = Regex.Replace(line[2..], @"\{\{(?:lb|lbl|label)\|ka\|([^}]*)\}\}",
                    m => $"({string.Join(", ", m.Groups[1].Value.Split('|'))})");
                gloss = Regex.Replace(gloss, @"\{\{[^}]*\}\}", string.Empty);
                gloss = Regex.Replace(gloss, @"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", "$1");
                gloss = Regex.Replace(gloss, "'''?", string.Empty);
                return Regex.Replace(gloss, @"\s+", " ").Trim();
            })
            .Where(gloss => gloss.Length > 0)
            .ToList();
    }
}
