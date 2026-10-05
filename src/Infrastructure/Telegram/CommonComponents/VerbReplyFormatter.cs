using Application.Verbs;
using Domain.Entities;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

/// <summary>
/// How the bot mentions a verb under a translation: one parse line and a button that opens the
/// mini-app on the verb card. The Russian copy is here; every Georgian word comes from the hint,
/// i.e. from the verb base.
/// </summary>
public static class VerbReplyFormatter
{
    // Grammar terms stay, each with a short gloss — same wording as TENSES in the mini-app (verbs/types.ts).
    private static readonly Dictionary<string, string> Tenses = new()
    {
        ["present"] = "настоящее время",
        ["imperfect"] = "имперфект (делал — прошедшее как процесс)",
        ["presentSubjunctive"] = "конъюнктив настоящего (чтобы делал)",
        ["future"] = "будущее время",
        ["conditional"] = "условное (сделал бы)",
        ["futureSubjunctive"] = "конъюнктив будущего (если бы сделал)",
        ["aorist"] = "аорист (сделал — прошедшее с результатом)",
        ["optative"] = "конъюнктив аориста (должен сделать)",
        ["perfect"] = "перфект (оказывается, сделал)",
        ["pluperfect"] = "плюсквамперфект (должен был сделать)",
        ["perfectSubjunctive"] = "конъюнктив перфекта (пожелания, тосты)"
    };

    private static readonly string[] Persons = ["я", "ты", "он/она", "мы", "вы", "они"];

    /// <summary>E.g. «Разбор: {form} — аорист (…), «мы». Глагол {masdar} — писать.»</summary>
    public static string Line(VerbReplyHint hint)
    {
        var verb = $"Глагол {hint.Title} — {hint.Translation}.";
        if (hint.Status == VerbStatus.Generated)
        {
            verb += " Формы не проверены.";
        }

        if (hint.Form == null || hint.Tense == null || hint.Person is not (>= 0 and < 6))
        {
            return verb;
        }

        var tense = Tenses.GetValueOrDefault(hint.Tense, hint.Tense);
        return $"Разбор: {hint.Form} — {tense}, «{Persons[hint.Person.Value]}». {verb}";
    }

    /// <summary>
    /// Opens the mini-app's dictionary with the verb card on top, on the tense and person of the form.
    /// The link is parsed by <c>parseDeepLink</c> in <c>miniapp-src/src/App.tsx</c>.
    /// </summary>
    public static InlineKeyboardButton Button(VerbReplyHint hint, string miniAppUrl)
    {
        var url = $"{miniAppUrl.TrimEnd('/')}/?screen=verb&verb={Uri.EscapeDataString(hint.Lemma)}";
        if (hint.Tense != null && hint.Person != null)
        {
            url += $"&tense={Uri.EscapeDataString(hint.Tense)}&person={hint.Person}";
        }

        return InlineKeyboardButton.WithWebApp($"Все формы: {hint.Title}", new WebAppInfo { Url = url });
    }
}
