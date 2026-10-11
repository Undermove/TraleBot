using System.Text;
using Application.Verbs;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

/// <summary>
/// The bot's reply to a word that is a verb of the base (<see cref="VerbTranslationCard"/>): the verb
/// with its key forms for a Russian infinitive, or what exactly a Georgian form says. The Russian copy
/// is here; every Georgian word comes from the card, i.e. from the verb base. Transcription is
/// Cyrillic, and no tense is called by its textbook name.
/// </summary>
public static class VerbCardReplyFormatter
{
    /// <param name="word">The word as saved in the dictionary.</param>
    /// <param name="definition">What the dictionary keeps for it.</param>
    /// <param name="alreadySaved">The word was in the dictionary before this request.</param>
    public static string Text(VerbTranslationCard card, string word, string definition, string? example, bool alreadySaved)
    {
        var text = new StringBuilder();
        switch (card.Kind)
        {
            case VerbCardKind.Form:
                AppendForm(text, card);
                break;
            case VerbCardKind.ActionName:
                AppendVerbs(
                    text, card,
                    one: verb => $"{card.Text} [{card.TextTranscription}] — название действия: «{verb.Translation}»",
                    many: $"{card.Text} [{card.TextTranscription}] — название действия. Так называются {Verbs(card.Verbs.Count)}:",
                    title: verb => $"«{verb.Translation}» — {verb.Lemma} [{verb.LemmaTranscription}]");
                break;
            default:
                AppendVerbs(
                    text, card,
                    one: verb => $"Глагол «{verb.Translation}»" + ActionNameLine(verb, "\n\n"),
                    many: $"«{card.Text}» — в базе {Verbs(card.Verbs.Count)}:",
                    title: verb => verb.ActionName == null
                        ? $"{verb.Lemma} [{verb.LemmaTranscription}] — {verb.Translation}"
                        : $"{verb.ActionName} [{verb.ActionNameTranscription}] — {verb.Translation}");
                break;
        }

        if (card.MoreVerbs > 0)
        {
            text.Append($"\n\nЕсть и другие, ещё {card.MoreVerbs} — их можно найти в разделе «Глаголы».");
        }

        if (card.Related is { Count: > 0 } related)
        {
            text.Append($"\n\nЕщё в разделе «Глаголы»: {string.Join(", ", related.Select(gloss => $"«{gloss}»"))}.");
        }

        if (!string.IsNullOrWhiteSpace(example))
        {
            text.Append($"\n\nПример: {example}");
        }

        text.Append($"\n\n{(alreadySaved ? "Уже в словаре" : "В словарь записано")}: {word} — {definition}");
        if (card.Kind == VerbCardKind.Infinitive && card.Verbs.FirstOrDefault(v => v.Lemma == definition) is { } asForm)
        {
            // The dictionary got the form «он …», not the name of the action: say so instead of passing one for the other.
            var he = asForm.Lines.FirstOrDefault(l => l is { Tense: "present", Person: 2, Meaning: not null });
            text.Append(he == null ? string.Empty : $" (это «{he.Meaning}»; названия действия для этого глагола в базе пока нет)");
        }

        return text.ToString();
    }

    private static void AppendVerbs(
        StringBuilder text, VerbTranslationCard card, Func<VerbCardVerb, string> one, string many, Func<VerbCardVerb, string> title)
    {
        if (card.Verbs.Count == 1)
        {
            text.Append(one(card.Verbs[0])).Append("\n\n").Append(KeyForms(card.Verbs[0]));
            return;
        }

        text.Append(many);
        for (var n = 0; n < card.Verbs.Count; n++)
        {
            text.Append($"\n\n{n + 1}. {title(card.Verbs[n])}\n").Append(KeyForms(card.Verbs[n]));
        }
    }

    private static string ActionNameLine(VerbCardVerb verb, string separator) =>
        verb.ActionName == null ? string.Empty : $"{separator}Название действия: {verb.ActionName} [{verb.ActionNameTranscription}]";

    /// <summary>«я делаю — ვაკეთებ [вак’этэб]», one line per key form.</summary>
    private static string KeyForms(VerbCardVerb verb) => string.Join("\n", verb.Lines.Select(line =>
    {
        var russian = line.Meaning == null ? line.Caption : line.Note == null ? line.Meaning : $"{line.Meaning} ({line.Note})";
        return $"{russian} — {Georgian(line)}";
    }));

    private static string Georgian(VerbCardLine line) => string.Join(
        " / ", line.Variants.Select(form => $"{form} [{Application.Translation.Languages.GeorgianTranscriptionExtension.GetTranscription(form)}]"));

    private static void AppendForm(StringBuilder text, VerbTranslationCard card)
    {
        var head = $"{card.Text} [{card.TextTranscription}]";
        if (card.Verbs is [{ Lines: [var only] } verb])
        {
            // One verb, one reading: the translation first, then what the form is and whose it is.
            text.Append(only.Meaning == null ? head : $"{head} — «{only.Meaning}»")
                .Append($"\nФорма: {only.Caption}.")
                .Append($"\n{Verb(verb)}.");
            return;
        }

        text.Append(card.Verbs.Sum(v => v.Lines.Count) > 1 ? $"{head} — у этого слова несколько значений:" : head);
        foreach (var each in card.Verbs)
        {
            text.Append($"\n\n{Verb(each)}");
            foreach (var line in each.Lines)
            {
                text.Append(line.Meaning == null ? $"\n• {line.Caption}" : $"\n• «{line.Meaning}» · {line.Caption}");
            }
        }
    }

    /// <summary>«Глагол «находить», название действия: პოვნა [п’овна]».</summary>
    private static string Verb(VerbCardVerb verb) => verb.ActionName == null
        ? $"Глагол «{verb.Translation}» ({verb.Lemma} [{verb.LemmaTranscription}])"
        : $"Глагол «{verb.Translation}», название действия: {verb.ActionName} [{verb.ActionNameTranscription}]";

    private static string Verbs(int count) => count is >= 2 and <= 4 ? $"{count} глагола" : $"{count} глаголов";

    /// <summary>
    /// One «Открыть в глаголах» button per verb of the card: the mini-app on the verb's screen, for a
    /// form — on its tense and person (same link as <see cref="VerbReplyFormatter.Button"/>).
    /// </summary>
    public static IEnumerable<InlineKeyboardButton> Buttons(VerbTranslationCard card, string miniAppUrl) =>
        card.Verbs.Select(verb =>
        {
            var at = card.Kind == VerbCardKind.Form ? verb.Lines.FirstOrDefault() : null;
            var label = card.Verbs.Count == 1 ? "Открыть в глаголах" : $"Открыть в глаголах: «{verb.Translation}»";
            return InlineKeyboardButton.WithWebApp(
                label, new WebAppInfo { Url = VerbReplyFormatter.Link(miniAppUrl, verb.Lemma, at?.Tense, at?.Person) });
        });
}
