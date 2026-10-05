using System;
using System.Collections.Generic;
using System.Linq;

namespace Application.Verbs;

/// <summary>How regular a verb is, computed from its forms alone.</summary>
/// <param name="Kind">"pattern" | "feature" | "special".</param>
/// <param name="Scheme">"preverb" | "medial" | null — how future and aorist are built from the present.</param>
/// <param name="Root">Shared root for highlighting; empty for special verbs.</param>
public record VerbAnalysis(string Kind, string? Scheme, string Root, IReadOnlyList<string> OddTenses, string Reason);

/// <summary>
/// C# port of <c>scripts/verbs/analyze.mjs</c>: the classification the catalog script computes offline,
/// needed for a verb card created at runtime. It works on the forms themselves, no grammar knowledge
/// "from memory". Must stay in step with the script — <c>VerbAnalyzerCatalogParityTests</c> pins every
/// catalog verb to the kind / root / odd tenses / reason stored in <c>verbs.json</c>.
/// </summary>
public static class VerbAnalyzer
{
    /// <summary>The six tenses of the card, in the script's order.</summary>
    public static readonly IReadOnlyList<string> CardTenses =
        ["present", "aorist", "imperfect", "optative", "conditional", "future"];

    // Hand corrections where counting letters is wrong: one root that changes a lot. Same list as in the script.
    private static readonly HashSet<string> SameRoot = ["პოულობს"];

    private const string Vowels = "აეიოუ";
    private const string FirstPersonMarker = "ვ";
    private const string MedialFutureStart = "ვი";

    /// <param name="lemma">Dictionary form of the verb.</param>
    /// <param name="tenses">tense → six persons → variants of the form.</param>
    public static VerbAnalysis Analyze(string lemma, IReadOnlyDictionary<string, string[][]> tenses)
    {
        string Form(string tense, int person) =>
            tenses.TryGetValue(tense, out var persons) && person < persons.Length && persons[person].Length > 0
                ? persons[person][0]
                : string.Empty;

        var card = CardTenses.Where(t => Form(t, 0).Length > 0).ToList();
        string Second(string tense) => Form(tense, 1) is { Length: > 0 } second ? second : Form(tense, 0);
        var present2 = Second("present");

        // The optative is checked against the aorist and the conditional against the future: inside a pair
        // the stem is shared, while short roots make a direct comparison with the present unreliable.
        bool IsOdd(string tense)
        {
            var via = tense switch { "optative" => "aorist", "conditional" => "future", _ => null };
            if (via != null && Second(via).Length > 0 && Related(Second(via), Second(tense)))
            {
                return IsOdd(via);
            }

            return !Related(present2, Second(tense));
        }

        var oddTenses = SameRoot.Contains(lemma)
            ? new List<string>()
            : card.Where(t => t != "present" && IsOdd(t)).ToList();

        // The root is searched over the 1st and 2nd person at once, so the person marker does not get into it.
        var sample = card.SelectMany(t => new[] { Form(t, 0), Form(t, 1) }).Where(f => f.Length > 0).ToList();
        var root = sample.Aggregate(sample.FirstOrDefault() ?? string.Empty, Lcs);

        if (oddTenses.Count > 0)
        {
            return new VerbAnalysis("special", null, string.Empty, oddTenses,
                "В разных временах разные корни — учить целиком.");
        }

        var p1 = Form("present", 0);
        var f1 = Form("future", 0);
        var scheme = p1.Length > 0 && f1.EndsWith(p1, StringComparison.Ordinal)
            ? "preverb"
            : p1.StartsWith(FirstPersonMarker, StringComparison.Ordinal) && f1.StartsWith(MedialFutureStart, StringComparison.Ordinal)
                ? "medial"
                : null;
        var preverb = scheme == "preverb" ? f1[..^p1.Length] : string.Empty;

        var hasVariants = card.Any(t => tenses[t][0].Length > 1);
        var skeletonRoot = sample.Count == 0 ? string.Empty : sample.Select(Skeleton).Aggregate(Lcs);
        var vowelShift = skeletonRoot.Length > Skeleton(root).Length;

        if (hasVariants)
        {
            return new VerbAnalysis("feature", scheme, root, oddTenses, "У некоторых форм два равноправных варианта.");
        }

        if (vowelShift)
        {
            return new VerbAnalysis("feature", scheme, root, oddTenses,
                "В части форм внутри корня появляется или выпадает гласная.");
        }

        if (scheme == null)
        {
            return new VerbAnalysis("feature", scheme, root, oddTenses,
                "Будущее и прошедшее строятся не от формы настоящего.");
        }

        var reason = scheme == "preverb"
            ? preverb.Length > 0
                ? $"Будущее и аорист = приставка {preverb}- + основа настоящего."
                : "Будущее совпадает с настоящим, приставки нет."
            : "Будущее и аорист получают ი- после показателя лица, приставки нет.";
        return new VerbAnalysis("pattern", scheme, root, oddTenses, reason);
    }

    /// <summary>Longest common substring; of several equally long ones the leftmost in <paramref name="a"/> wins, as in the script.</summary>
    private static string Lcs(string a, string b)
    {
        var best = string.Empty;
        for (var i = 0; i < a.Length; i++)
        {
            for (var j = i + 1; j <= a.Length; j++)
            {
                if (j - i > best.Length && b.Contains(a[i..j], StringComparison.Ordinal))
                {
                    best = a[i..j];
                }
            }
        }

        return best;
    }

    private static string Skeleton(string s) => new(s.Where(c => !Vowels.Contains(c)).ToArray());

    private static bool Related(string a, string b) =>
        Lcs(a, b).Length >= 3 || Lcs(Skeleton(a), Skeleton(b)).Length >= 2;
}
