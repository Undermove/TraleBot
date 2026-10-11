using System.Collections.Generic;
using System.Linq;
using Domain.Entities;

namespace Application.Feedback;

/// <summary>
/// What a survey form must be to be sent: checked the same way for a ready-made form and for one
/// the owner built. The first question lives in the bot's message, so it is stricter than the rest.
/// </summary>
public static class SurveyFormRules
{
    public const int MaxQuestions = 6;
    public const int MaxOptions = 6;
    /// <summary>The first question's options are buttons under a message in the chat.</summary>
    public const int MaxBotOptions = 4;
    public const int MaxOptionLength = 64;
    public const int MaxQuestionLength = 300;
    public const int MaxIntroLength = 500;

    /// <summary>
    /// Returns the form trimmed, with ids given by position ("q1", "q2"…), or null and the reason
    /// in plain Russian. Blank options are dropped before counting.
    /// </summary>
    public static SurveyForm? Normalize(SurveyForm? form, out string? error)
    {
        error = Check(form, out var normalized);
        return error == null ? normalized : null;
    }

    private static string? Check(SurveyForm? form, out SurveyForm? normalized)
    {
        normalized = null;
        if (form?.Questions is not { Count: > 0 }) return "В опросе нет ни одного вопроса.";
        if (form.Questions.Count > MaxQuestions) return $"В опросе не больше {MaxQuestions} вопросов.";
        var intro = string.IsNullOrWhiteSpace(form.Intro) ? null : form.Intro.Trim();
        if (intro is { Length: > MaxIntroLength }) return $"Вступление длиннее {MaxIntroLength} символов.";

        var questions = new List<SurveyQuestion>();
        foreach (var (source, index) in form.Questions.Select((q, i) => (q, i)))
        {
            var number = index + 1;
            var text = (source?.Text ?? "").Trim();
            if (text.Length == 0) return $"Вопрос {number}: нет текста.";
            if (text.Length > MaxQuestionLength) return $"Вопрос {number}: текст длиннее {MaxQuestionLength} символов.";

            var question = new SurveyQuestion { Id = $"q{number}", Text = text, Kind = source!.Kind };
            if (source.Kind == SurveyQuestionKind.Choice)
            {
                // Keys travel with their options: a blank option is dropped together with its key.
                var kept = (source.Options ?? [])
                    .Select((o, i) => (Text: (o ?? "").Trim(), Key: source.OptionKeys?.ElementAtOrDefault(i)?.Trim() ?? ""))
                    .Where(o => o.Text.Length > 0).ToList();
                var options = kept.Select(o => o.Text).ToList();
                var keys = kept.Select(o => o.Key).ToList();
                if (options.Count is < 2 or > MaxOptions) return $"Вопрос {number}: от 2 до {MaxOptions} вариантов ответа.";
                if (options.Any(o => o.Length > MaxOptionLength)) return $"Вопрос {number}: вариант длиннее {MaxOptionLength} символов.";
                if (options.Distinct().Count() != options.Count) return $"Вопрос {number}: варианты повторяются.";
                if (source.AllowOther && options.Contains(SurveyForm.OtherLabel))
                    return $"Вопрос {number}: вариант «{SurveyForm.OtherLabel}» уже добавляет переключатель «свой ответ» — убери его из списка.";
                question.Options = options;
                question.AllowOther = source.AllowOther;
                if (keys.Where(k => k.Length > 0).GroupBy(k => k).Any(g => g.Count() > 1)) return $"Вопрос {number}: ключи вариантов повторяются.";
                if (keys.Any(k => k.Length > 0)) question.OptionKeys = keys;
                // The headline number lives while both of its options are still there — whatever they are called now.
                if (!string.IsNullOrEmpty(source.HeadlineOption) && keys.Contains(source.HeadlineOption)
                    && (string.IsNullOrEmpty(source.HeadlineWithout) || keys.Contains(source.HeadlineWithout)))
                {
                    question.HeadlineOption = source.HeadlineOption;
                    question.HeadlineWithout = string.IsNullOrEmpty(source.HeadlineWithout) ? null : source.HeadlineWithout;
                }
            }
            else if (source.Kind != SurveyQuestionKind.Text)
            {
                return $"Вопрос {number}: неизвестный тип.";
            }
            questions.Add(question);
        }

        var first = questions[0];
        if (first.Kind != SurveyQuestionKind.Choice)
            return "Первый вопрос приходит в бот кнопками, поэтому он должен быть с вариантами ответа. Поставь свободный вопрос вторым или дальше.";
        if (first.Options.Count > MaxBotOptions)
            return $"Первый вопрос приходит в бот кнопками — у него не больше {MaxBotOptions} вариантов. Убери лишние или поставь первым другой вопрос.";

        normalized = new SurveyForm { Intro = intro, Questions = questions };
        return null;
    }
}
