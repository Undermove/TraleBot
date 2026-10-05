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

    // Hand corrections where counting letters does not see the single root. Same list as in the script.
    private static readonly HashSet<string> SameRoot = ["პოულობს", "დებს"];

    private const string Vowels = "აეიოუ";
    private const string FirstPersonMarker = "ვ";
    private const string MedialFutureStart = "ვი";
    private const string ThematicSuffix = "ებ";

    // Person prefixes of an inverted verb in the present: "to me", "to you", "to us".
    private const string InvertedFirst = "მ";
    private const string InvertedSecond = "გ";
    private const string InvertedFirstPlural = "გვ";

    /// <summary>
    /// "The source has only a part of the tenses": the present, the future or the aorist row is missing
    /// or has an empty person. The rule of <c>isPartial</c> in <c>scripts/verbs/build-catalog.mjs</c>;
    /// it needs nothing but the table, so a verb read from Wiktionary at runtime gets the same answer.
    /// </summary>
    public static bool IsPartial(IReadOnlyDictionary<string, string[][]> tenses)
    {
        bool Complete(string tense) =>
            tenses.TryGetValue(tense, out var row) && row.Length == 6 && row.All(cell => cell.Length > 0);

        return !(Complete("present") && Complete("future") && Complete("aorist"));
    }

    /// <param name="lemma">Dictionary form of the verb.</param>
    /// <param name="tenses">tense → six persons → variants of the form.</param>
    /// <param name="partial">Left out, it is <see cref="IsPartial"/> of the table — what the catalog build passes.</param>
    public static VerbAnalysis Analyze(string lemma, IReadOnlyDictionary<string, string[][]> tenses, bool? partial = null)
    {
        var isPartial = partial ?? IsPartial(tenses);

        string Form(string tense, int person) =>
            tenses.TryGetValue(tense, out var persons) && person < persons.Length && persons[person].Length > 0
                ? persons[person][0]
                : string.Empty;

        var card = CardTenses.Where(t => Form(t, 0).Length > 0).ToList();

        if (tenses.TryGetValue("present", out var presentRow) && IsInverted(presentRow))
        {
            return new VerbAnalysis("special", null, string.Empty, [],
                "Перевёртыш: кто действует, показывает начало формы («мне», «тебе», «нам»), а не окончание."
                + (isPartial ? " В источнике есть только часть времён." : string.Empty));
        }

        if (isPartial)
        {
            return new VerbAnalysis("special", null, string.Empty, [],
                "В источнике есть только часть времён — учить формы целиком.");
        }

        string Whole(string tense) => Form(tense, 1) is { Length: > 0 } second ? second : Form(tense, 0);
        var cut = SharedPreverb(card.Select(Whole).ToList());
        string Second(string tense) => Whole(tense) is var form && form.Length > cut ? form[cut..] : string.Empty;

        // Right after the preverb the forms start alike — the root is shared even when it is too short
        // for counting letters.
        bool SameStart(string a, string b) => cut > 0 && CommonPrefix(a, b).Length >= 2;

        // The optative is checked against the aorist and the conditional against the future: inside a pair
        // the stem is shared, while short roots make a direct comparison with the present unreliable.
        bool IsOdd(string tense)
        {
            var via = tense switch { "optative" => "aorist", "conditional" => "future", _ => null };
            if (via != null && Second(via).Length > 0 && Related(Second(via), Second(tense)))
            {
                return IsOdd(via);
            }

            return !SameStart(Second("present"), Second(tense)) && !Related(Second("present"), Second(tense));
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
        var a1 = Form("aorist", 0);

        // The "no preverb" scheme: future = person marker + ი + stem + thematic suffix. The stem is the
        // common start of the present (without the marker) and the future (without marker + ი); if the
        // future does not continue with the suffix, it is not the scheme any more.
        var medialStem = p1.StartsWith(FirstPersonMarker, StringComparison.Ordinal) && f1.StartsWith(MedialFutureStart, StringComparison.Ordinal)
            ? CommonPrefix(p1[1..], f1[2..])
            : string.Empty;
        var futureTail = f1.Length >= 2 ? f1[2..] : string.Empty;
        var scheme =
            p1.Length > 0 && f1 == p1 ? "same"
            : p1.Length > 0 && f1.EndsWith(p1, StringComparison.Ordinal) ? "preverb"
            : medialStem.Length >= 2 && (futureTail == medialStem + ThematicSuffix
                                         || (futureTail == medialStem && medialStem.EndsWith(ThematicSuffix, StringComparison.Ordinal))) ? "medial"
            : null;
        var preverb = scheme == "preverb" ? f1[..^p1.Length] : string.Empty;

        var hasVariants = card.Any(t => tenses[t][0].Length > 1);
        var skeletonRoot = sample.Count == 0 ? string.Empty : sample.Select(Skeleton).Aggregate(Lcs);
        var vowelShift = skeletonRoot.Length > Skeleton(root).Length;

        // An aorist "by the pattern" is the stem of the future with one letter of ending in place of the
        // thematic suffix (up to three letters). A bigger difference means the stem itself changes.
        var stem = CommonPrefix(f1, a1);
        var aoristShift = f1.Length > 0 && a1.Length > 0 && (a1.Length - stem.Length > 1 || f1.Length - stem.Length > 3);

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

        if (aoristShift)
        {
            return new VerbAnalysis("feature", scheme, root, oddTenses,
                "В аористе меняется основа, а не только окончание.");
        }

        var reason = scheme switch
        {
            "preverb" => $"Будущее и аорист = приставка {preverb}- + основа настоящего.",
            "same" => "Будущее совпадает с настоящим, приставки нет.",
            _ => "Будущее и аорист получают ი- после показателя лица, приставки нет."
        };
        return new VerbAnalysis("pattern", scheme, root, oddTenses, reason);
    }

    /// <summary>
    /// Inversion: the person is shown by a prefix ("to me / to you / to us") and the rest of the form is
    /// the same for "I" and "you". Decided by the present row.
    /// </summary>
    private static bool IsInverted(string[][] present)
    {
        string First(int person) => person < present.Length && present[person].Length > 0 ? present[person][0] : string.Empty;
        var (p1, p2, p4) = (First(0), First(1), First(3));
        return p1.StartsWith(InvertedFirst, StringComparison.Ordinal)
               && p2.StartsWith(InvertedSecond, StringComparison.Ordinal)
               && p4.StartsWith(InvertedFirstPlural, StringComparison.Ordinal)
               && p1[1..] == p2[1..];
    }

    /// <summary>
    /// A preverb that stands in every form of the card is their common start, and it is no argument for
    /// a common root, so it is cut off before the roots are compared — but only when every form still
    /// has something left to compare (3 letters or more): otherwise the common start is the root itself.
    /// </summary>
    private static int SharedPreverb(IReadOnlyList<string> forms)
    {
        if (forms.Count < 2)
        {
            return 0;
        }

        var prefix = forms.Aggregate(CommonPrefix);
        return prefix.Length > 0 && forms.All(f => f.Length - prefix.Length >= 3) ? prefix.Length : 0;
    }

    private static string CommonPrefix(string a, string b)
    {
        var i = 0;
        while (i < a.Length && i < b.Length && a[i] == b[i])
        {
            i++;
        }

        return a[..i];
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
