using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Application.Verbs;

/// <summary>Past forms of a Russian verb: «писал», «писала», «писали».</summary>
public record RussianPast(
    [property: JsonPropertyName("m")] string M,
    [property: JsonPropertyName("f")] string F,
    [property: JsonPropertyName("pl")] string Pl);

/// <summary>
/// Forms of a Russian verb — one entry of <c>scripts/verbs/ru-forms.json</c>. The catalog's entries are
/// produced offline (pymorphy3); for a verb written by a model the model supplies the same shape.
/// </summary>
/// <param name="Inf">The infinitive the phrases are built from.</param>
/// <param name="Present">Six personal forms of an imperfective verb; null for a perfective one.</param>
/// <param name="Future">Six simple-future forms of a perfective verb; null — the future is «буду + inf».</param>
/// <param name="Tail">What follows the verb in every phrase («за кем-то»).</param>
/// <param name="Phrases">Ready phrases by tense, for verbs Russian says differently («у меня есть»).</param>
/// <param name="Perfective">
/// The perfective partner («сказать» for «говорить»), when the main forms are imperfective. Not in the
/// catalog's data: there every phrase is built from one imperfective verb.
/// </param>
public record RussianVerbForms(
    [property: JsonPropertyName("inf")] string? Inf = null,
    [property: JsonPropertyName("past")] RussianPast? Past = null,
    [property: JsonPropertyName("present")] string[]? Present = null,
    [property: JsonPropertyName("future")] string[]? Future = null,
    [property: JsonPropertyName("tail")] string? Tail = null,
    [property: JsonPropertyName("phrases")] Dictionary<string, string[]>? Phrases = null,
    [property: JsonPropertyName("perfective")] RussianVerbForms? Perfective = null);

/// <param name="Meanings">tense → six phrases, for the tenses that could be built.</param>
/// <param name="Chips">tense → the note that tells it from another tense with the same phrase.</param>
/// <param name="Problems">Why a tense got no phrases, or two cells that would read the same.</param>
public record VerbMeanings(
    IReadOnlyDictionary<string, string[]> Meanings,
    IReadOnlyDictionary<string, string> Chips,
    IReadOnlyList<string> Problems);

/// <summary>
/// What a form means in plain Russian, without tense names: «я хочу», «ты хотел(а)», «мы будем писать».
/// The C# side of <c>scripts/verbs/meanings.mjs</c>, which builds the same phrases for the catalog;
/// <c>VerbMeaningBuilderTests</c> ties the two: this code must reproduce every phrase of
/// <c>verbs.json</c> from <c>ru-forms.json</c>. Used for verbs stored at runtime.
/// <para>
/// One rule lives only here: a record may carry the perfective partner of its Russian verb. Then the
/// tenses Georgian builds with a preverb read as Russian reads them — the one-off past «я сказал(а)»,
/// the future «я скажу», «мне надо сказать», «я бы сказал(а)» — and the present and the long past stay
/// with the imperfective verb («я говорю», «я говорил(а)»).
/// </para>
/// </summary>
public static class VerbMeaningBuilder
{
    private static readonly string[] Who = ["я", "ты", "он", "мы", "вы", "они"];
    private static readonly string[] Whom = ["мне", "тебе", "ему", "нам", "вам", "им"];
    private static readonly string[] Will = ["буду", "будешь", "будет", "будем", "будете", "будут"];

    private static readonly Dictionary<string, string> ChipTexts = new()
    {
        ["present"] = "сейчас", ["future"] = "потом", ["imperfect"] = "долго или часто", ["aorist"] = "один раз · сделано"
    };

    private static readonly string[] PerfectiveTenses = ["aorist", "future", "optative", "conditional"];

    private static readonly Regex RussianWords = new("^[а-яё]+( [а-яё-]+){0,3}$", RegexOptions.Compiled);

    /// <summary>Phrases for the main tenses the verb has (<paramref name="tenses"/> — the keys of its table).</summary>
    public static VerbMeanings Build(RussianVerbForms forms, IReadOnlyCollection<string> tenses)
    {
        var meanings = new Dictionary<string, string[]>();
        var problems = new List<string>();
        foreach (var tense in VerbAnalyzer.CardTenses.Where(tenses.Contains))
        {
            var row = forms.Phrases != null
                ? forms.Phrases.GetValueOrDefault(tense)
                : Enumerable.Range(0, 6).Select(person => Phrase(forms, tense, person)).ToArray();
            if (row == null || row.Length != 6 || row.Any(string.IsNullOrEmpty))
            {
                problems.Add($"нет русской фразы для времени {tense}");
                continue;
            }

            meanings[tense] = row!;
        }

        var chips = new Dictionary<string, string>();
        foreach (var tense in meanings.Keys)
        {
            var sameAsAnother = meanings.Keys.Any(other =>
                other != tense && Enumerable.Range(0, 6).Any(person => meanings[other][person] == meanings[tense][person]));
            if (sameAsAnother && ChipTexts.TryGetValue(tense, out var chip))
            {
                chips[tense] = chip;
            }
        }

        // A phrase with its note must name one cell: otherwise an exercise shows two identical options.
        for (var person = 0; person < 6; person++)
        {
            var seen = new Dictionary<string, string>();
            foreach (var tense in meanings.Keys)
            {
                var key = $"{meanings[tense][person]}|{chips.GetValueOrDefault(tense, string.Empty)}";
                if (seen.TryGetValue(key, out var other))
                {
                    problems.Add($"«{meanings[tense][person]}» — одинаково для {other} и {tense}");
                }

                seen[key] = tense;
            }
        }

        return new VerbMeanings(meanings, chips, problems);
    }

    /// <summary>
    /// What is wrong with forms a model wrote, in words the model can act on; empty when they have the
    /// shape the builder needs. Shape only — whether «писал» is the past of «писать» is the reviewer's job.
    /// </summary>
    public static IReadOnlyList<string> ShapeProblems(RussianVerbForms? forms)
    {
        if (forms == null)
        {
            return ["russianForms is missing"];
        }

        var problems = new List<string>();
        Check(forms, "russianForms", needsPersonal: true, problems);
        if (forms.Perfective != null)
        {
            Check(forms.Perfective, "russianForms.perfective", needsPersonal: false, problems);
            if (forms.Perfective.Future is not { Length: 6 })
            {
                problems.Add("russianForms.perfective.future must have six personal forms");
            }
        }

        return problems;
    }

    private static void Check(RussianVerbForms forms, string name, bool needsPersonal, List<string> problems)
    {
        bool Word(string? value) => value != null && RussianWords.IsMatch(value.Trim().ToLowerInvariant());

        if (!Word(forms.Inf))
        {
            problems.Add($"{name}.inf must be a Russian infinitive in Cyrillic");
        }

        if (forms.Past == null || !Word(forms.Past.M) || !Word(forms.Past.F) || !Word(forms.Past.Pl))
        {
            problems.Add($"{name}.past must have m, f and pl in Cyrillic");
        }

        foreach (var (row, label) in new[] { (forms.Present, "present"), (forms.Future, "future") })
        {
            if (row != null && (row.Length != 6 || !row.All(Word)))
            {
                problems.Add($"{name}.{label} must have six personal forms in Cyrillic");
            }
        }

        if (needsPersonal && forms.Present == null && forms.Future == null)
        {
            problems.Add($"{name} needs present (imperfective verb) or future (perfective verb)");
        }

        if (!string.IsNullOrWhiteSpace(forms.Tail) && !Word(forms.Tail))
        {
            problems.Add($"{name}.tail must be Russian words");
        }
    }

    /// <summary>The past for a person: the gender of «я» and «ты» is unknown — «хотел(а)», «шёл / шла».</summary>
    private static string? PastOf(RussianVerbForms forms, int person)
    {
        if (forms.Past == null)
        {
            return null;
        }

        var (m, f, pl) = forms.Past;
        return person >= 3 ? pl : person == 2 ? m : f == m + "а" ? $"{m}(а)" : $"{m} / {f}";
    }

    private static string? Phrase(RussianVerbForms forms, string tense, int person)
    {
        // The tenses Georgian builds with a preverb take the perfective partner when the record has one.
        var verb = forms.Perfective != null && PerfectiveTenses.Contains(tense)
            ? forms.Perfective with { Tail = forms.Perfective.Tail ?? forms.Tail }
            : forms;
        var who = Who[person];
        var text = tense switch
        {
            // A perfective verb has no present: its personal forms are already the future.
            "present" => verb.Present != null ? $"{who} {verb.Present[person]}" : null,
            "aorist" or "imperfect" => PastOf(verb, person) is { } past ? $"{who} {past}" : null,
            "future" => verb.Future != null ? $"{who} {verb.Future[person]}" : verb.Inf != null ? $"{who} {Will[person]} {verb.Inf}" : null,
            "optative" => verb.Inf != null ? $"{Whom[person]} надо {verb.Inf}" : null,
            "conditional" => PastOf(verb, person) is { } past ? $"{who} бы {past}" : null,
            _ => null
        };
        return text != null && !string.IsNullOrWhiteSpace(verb.Tail) ? $"{text} {verb.Tail!.Trim()}" : text;
    }
}
