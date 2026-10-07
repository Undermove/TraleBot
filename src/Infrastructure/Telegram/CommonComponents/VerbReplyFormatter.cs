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
    // No grammar terms in the chat: the form is explained by its plain-Russian meaning from the verb
    // base («я хотел(а)»). When the base has none (rare tenses, verbs generated at runtime) the line
    // falls back to the person and the plain name of the time — the same names as TENSES[..].name in
    // the mini-app (verbs/types.ts).
    private static readonly Dictionary<string, string> PlainTime = new()
    {
        ["present"] = "сейчас",
        ["imperfect"] = "прошедшее: делал",
        ["presentSubjunctive"] = "чтобы делал",
        ["future"] = "будущее",
        ["conditional"] = "сделал бы",
        ["futureSubjunctive"] = "если бы сделал",
        ["aorist"] = "прошедшее: сделал",
        ["optative"] = "надо сделать",
        ["perfect"] = "оказывается, сделал",
        ["pluperfect"] = "должен был сделать",
        ["perfectSubjunctive"] = "пожелание, тост"
    };

    private static readonly string[] Persons = ["я", "ты", "он/она", "мы", "вы", "они"];

    /// <summary>E.g. «Разбор: {form} — «мы писали» (один раз · сделано). Глагол {masdar} — писать.»</summary>
    public static string Line(VerbReplyHint hint)
    {
        var verb = $"Глагол {hint.Title} — {hint.Translation}.";
        if (hint.Form == null || hint.Tense == null || hint.Person is not (>= 0 and < 6))
        {
            return verb;
        }

        return $"Разбор: {hint.Form} — {Meaning(hint)}. {verb}";
    }

    private static string Meaning(VerbReplyHint hint)
    {
        if (!string.IsNullOrEmpty(hint.Meaning))
        {
            return string.IsNullOrEmpty(hint.MeaningNote) ? $"«{hint.Meaning}»" : $"«{hint.Meaning}» ({hint.MeaningNote})";
        }

        var who = Persons[hint.Person!.Value];
        return PlainTime.TryGetValue(hint.Tense!, out var time) ? $"«{who} · {time}»" : $"«{who}»";
    }

    /// <summary>
    /// Opens the mini-app's dictionary with the verb card on top, on the tense and person of the form.
    /// <c>?screen=verb&amp;verbId=…[&amp;tense=…&amp;person=…]</c>, parsed by <c>miniapp-src/src/verbs/deepLink.ts</c>;
    /// without trial or Pro it lands on the paywall instead.
    /// </summary>
    public static InlineKeyboardButton Button(VerbReplyHint hint, string miniAppUrl)
    {
        var url = $"{miniAppUrl.TrimEnd('/')}/?screen=verb&verbId={Uri.EscapeDataString(hint.Lemma)}";
        if (hint.Tense != null && hint.Person != null)
        {
            url += $"&tense={Uri.EscapeDataString(hint.Tense)}&person={hint.Person}";
        }

        return InlineKeyboardButton.WithWebApp($"Все формы: {hint.Title}", new WebAppInfo { Url = url });
    }
}
