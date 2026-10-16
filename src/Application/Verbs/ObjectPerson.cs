using System;
using System.Collections.Generic;
using System.Linq;

namespace Application.Verbs;

/// <summary>
/// «Кто кого»: a verb that shows in the word whom it is done to — გხედავ «I see you», მხედავს «he sees
/// me». The card's table is «him»; the other sides follow one rule from it: the mark of «whom» (მ- me,
/// გ- you, გვ- us) takes the place of ვ- «I/we», after the preverb. The mini-app builds the forms by the
/// same rule (whoWhom/logic.ts); here it checks what a model claims against the rule.
/// </summary>
public static class ObjectPerson
{
    /// <summary>How the Russian says «whom»: «вижу тебя» (acc), «показываю тебе» (dat), «встречаюсь с тобой» (with).</summary>
    public static readonly IReadOnlyList<string> Cases = ["acc", "dat", "with"];

    public static string? Case(string? written)
    {
        var value = written?.Trim().ToLowerInvariant();
        return Cases.Contains(value) ? value : null;
    }

    /// <summary>The form «who → whom» of a tense row (six cells), or null when the rule does not fit the row.</summary>
    /// <param name="who">Person of the table: 0 I … 5 they.</param>
    /// <param name="whom">"me" | "you" | "us" | "youpl".</param>
    public static string? Form(string[][] row, int who, string whom)
    {
        var mark = whom switch { "me" => "მ", "you" or "youpl" => "გ", "us" => "გვ", _ => null };
        if (mark == null || row.Length != 6 || row[who].Length == 0)
        {
            return null;
        }

        var at = Slot(row);
        if (at == null)
        {
            return null;
        }

        var form = row[who][0];
        if (who is 0 or 3)
        {
            form = form.Remove(at.Value, 1);
        }

        form = form.Insert(at.Value, mark);
        if (whom == "youpl" && who != 5 && !form.EndsWith('თ'))
        {
            form = form.EndsWith('ს') ? form[..^1] + "თ" : form + "თ";
        }

        return form;
    }

    /// <summary>Forms by the rule a model's claims are checked against: «you → me» and «I → you» of the present.</summary>
    public static (string? YouMe, string? IYou) Controls(IReadOnlyDictionary<string, string[][]> tenses) =>
        tenses.TryGetValue("present", out var present) ? (Form(present, 1, "me"), Form(present, 0, "you")) : (null, null);

    /// <summary>All the «me / you / us» forms of the present, aorist and future the rule gives — for the corpus check.</summary>
    public static IReadOnlyList<string> AllForms(IReadOnlyDictionary<string, string[][]> tenses)
    {
        var own = tenses.Values.SelectMany(r => r).SelectMany(c => c).ToHashSet();
        var forms = new List<string>();
        foreach (var tense in new[] { "present", "aorist", "future" })
        {
            if (!tenses.TryGetValue(tense, out var row))
            {
                continue;
            }

            foreach (var whom in new[] { "me", "you", "us" })
            {
                for (var who = 0; who < 6; who++)
                {
                    var form = Possible(who, whom) ? Form(row, who, whom) : null;
                    if (form != null && !own.Contains(form) && !forms.Contains(form))
                    {
                        forms.Add(form);
                    }
                }
            }
        }

        return forms;
    }

    private static bool Possible(int who, string whom) =>
        !(who is 0 or 3 && whom is "me" or "us") && !(who is 1 or 4 && whom is "you" or "youpl");

    /// <summary>Where ვ- «I» stands: the I form is the you form with one ვ put in.</summary>
    private static int? Slot(string[][] row)
    {
        if (row[0].Length == 0 || row[1].Length == 0)
        {
            return null;
        }

        var (i, you) = (row[0][0], row[1][0]);
        for (var at = 0; at < i.Length; at++)
        {
            if (i[at] == 'ვ' && string.Concat(i.AsSpan(0, at), i.AsSpan(at + 1)) == you)
            {
                return at;
            }
        }

        return null;
    }
}
