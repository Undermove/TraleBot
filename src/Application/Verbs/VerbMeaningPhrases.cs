using System;
using System.Collections.Generic;
using System.Linq;

namespace Application.Verbs;

/// <summary>
/// Matching of a Russian verb form typed by a learner («ходил», «она шла», «мы писали») against the
/// plain-Russian meanings stored with every catalog form (<c>VerbForm.Meaning</c>: «я ходил(а)»,
/// «я шёл / шла», «мне надо идти»). Pure string work — this is what lets a Russian inflected verb be
/// answered from the database with no model.
/// </summary>
public static class VerbMeaningPhrases
{
    private static readonly string[] Subjects = ["я", "ты", "он", "мы", "вы", "они"];
    private static readonly string[] Datives = ["мне", "тебе", "ему", "нам", "вам", "им"];

    /// <summary>Pronouns a learner may type that the stored phrases do not have: «она», «оно», «ей».</summary>
    private static readonly Dictionary<string, int> ExtraPronouns = new() { ["она"] = 2, ["оно"] = 2, ["ей"] = 2 };

    /// <summary>
    /// Whom the action is for or at — «он сказал мне», «ему сказали», «я жду тебя». The stored phrases
    /// name only who acts, so such a pronoun is set aside and the rest is matched: the answer is the
    /// verb form for «он сказал», and the reply shows that phrase.
    /// </summary>
    private static readonly HashSet<string> ObjectPronouns =
    [
        "мне", "тебе", "ему", "ей", "нам", "вам", "им", "меня", "тебя", "его", "ее", "нас", "вас", "их"
    ];

    /// <summary>The words after which a leading «мне / ему» is who acts («мне надо идти»), not whom it is done to.</summary>
    private static readonly HashSet<string> DativeSubjectWords = ["надо", "нужно", "было", "будет"];

    /// <param name="Rest">The text without its leading pronoun.</param>
    /// <param name="Person">0..5 when the text names who acts, else null.</param>
    /// <param name="Feminine">The text says «она» / «ей»: the stored "he" phrase is masculine.</param>
    /// <param name="SetAside">The object pronoun that was left out of the match («мне» in «он сказал мне»), if any.</param>
    public record Asked(string Full, string Rest, int? Person, bool Feminine, string? SetAside = null);

    private static string Normalize(string text) => text.ToLowerInvariant().Replace('ё', 'е').Trim();

    /// <summary>Splits a looked-up text into the pronoun (if any) and the rest.</summary>
    public static Asked Parse(string text)
    {
        var full = Normalize(text);
        var words = full.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        string? setAside = null;
        if (words.Count > 1 && ObjectPronouns.Contains(words[^1]))
        {
            // «он сказал мне» → «он сказал».
            setAside = words[^1];
            words.RemoveAt(words.Count - 1);
        }
        else if (words.Count > 1 && ObjectPronouns.Contains(words[0]) && !DativeSubjectWords.Contains(words[1])
                 && !Subjects.Contains(words[0]))
        {
            // «ему сказали» → «сказали»: who acts is not named.
            setAside = words[0];
            words.RemoveAt(0);
        }

        full = string.Join(' ', words);
        var space = full.IndexOf(' ');
        if (space > 0)
        {
            var first = full[..space];
            var rest = full[(space + 1)..];
            var person = Array.IndexOf(Subjects, first) is >= 0 and var s ? s
                : Array.IndexOf(Datives, first) is >= 0 and var d ? d
                : ExtraPronouns.TryGetValue(first, out var e) ? e
                : (int?)null;
            if (person != null)
            {
                return new Asked(full, rest, person, ExtraPronouns.ContainsKey(first), setAside);
            }
        }

        return new Asked(full, full, null, false, setAside);
    }

    /// <summary>
    /// Every way the stored phrase can be typed, each as (with the pronoun, without it):
    /// «я ходил(а)» → «я ходил» / «ходил», «я ходила» / «ходила»; «я шёл / шла» → «я шел», «я шла».
    /// </summary>
    public static IEnumerable<(string Full, string Bare)> Variants(string meaning)
    {
        foreach (var spelled in Genders(Normalize(meaning)))
        {
            var space = spelled.IndexOf(' ');
            var first = space > 0 ? spelled[..space] : string.Empty;
            var hasPronoun = Subjects.Contains(first) || Datives.Contains(first);
            yield return (spelled, hasPronoun ? spelled[(space + 1)..] : spelled);
        }
    }

    /// <summary>
    /// Whether the stored phrase answers the text, the pronoun aside: «ходил» and «она ходила» both
    /// match «я ходил(а)». Which person is meant is decided by <see cref="PickPerson"/>.
    /// </summary>
    public static bool Matches(Asked asked, string meaning) =>
        Variants(meaning).Any(v => asked.Full == v.Full || asked.Rest == v.Bare);

    /// <summary>
    /// Of the persons whose phrase matched, the one to answer with; null when the text names a person
    /// that did not match. Russian past does not show the person («ходил» = я / ты / он): without a
    /// pronoun the answer is the 3rd person, the way a dictionary would read the bare form; «она ходила»
    /// is the 3rd person too, although the stored "he" phrase is masculine.
    /// </summary>
    public static int? PickPerson(Asked asked, IReadOnlyCollection<int> matched)
    {
        if (matched.Count == 0)
        {
            return null;
        }

        if (asked.Person is { } named)
        {
            return matched.Contains(named) || (named == 2 && matched.Any(p => p < 2)) ? named : null;
        }

        var singular = matched.Where(p => p < 3).ToList();
        if (singular.Count > 0)
        {
            return singular.Count == 1 ? singular[0] : 2;
        }

        return matched.Count == 1 ? matched.First() : 5;
    }

    /// <summary>The longest word of the text without a feminine ending — what the database is asked to narrow by.</summary>
    public static string SearchCore(Asked asked)
    {
        var longest = asked.Rest.Split(' ').OrderByDescending(w => w.Length).First();
        return longest.Length > 2 && longest.EndsWith('а') ? longest[..^1] : longest;
    }

    private static IEnumerable<string> Genders(string phrase)
    {
        if (phrase.Contains("(а)"))
        {
            yield return phrase.Replace("(а)", string.Empty);
            yield return phrase.Replace("(а)", "а");
            yield break;
        }

        // «я бы шел / шла за кем-то»: the two words around the slash are the alternatives.
        var slash = phrase.IndexOf(" / ", StringComparison.Ordinal);
        if (slash < 0)
        {
            yield return phrase;
            yield break;
        }

        var before = phrase[..slash];
        var after = phrase[(slash + 3)..];
        var lastSpace = before.LastIndexOf(' ');
        var nextSpace = after.IndexOf(' ');
        var head = lastSpace < 0 ? string.Empty : before[..(lastSpace + 1)];
        var tail = nextSpace < 0 ? string.Empty : after[nextSpace..];
        yield return head + before[(lastSpace + 1)..] + tail;
        yield return head + (nextSpace < 0 ? after : after[..nextSpace]) + tail;
    }
}
