using System.Collections.Generic;

namespace Application.Feedback;

/// <summary>
/// A ready-made survey for the owner's survey builder: the question and its answer buttons are
/// already written, so a survey can be sent without typing anything.
/// </summary>
/// <param name="Id">Latin, lower case — becomes a part of the campaign key (<c>survey-2026-10-missing</c>).</param>
/// <param name="Title">What the card in the builder is called.</param>
public record SurveyPreset(string Id, string Title, string Question, IReadOnlyList<string> Options);

public static class SurveyPresets
{
    /// <summary>The longest caption that still fits one inline button on a phone without being cut.</summary>
    public const int MaxButtonLength = 24;

    /// <summary>Id of a survey the owner writes from scratch.</summary>
    public const string Custom = "custom";

    public static readonly IReadOnlyList<SurveyPreset> All =
    [
        new("missing", "Чего не хватает",
            "Чего тебе не хватает в TraleBot?",
            ["Озвучки слов", "Больше уроков", "Разговорной практики", "Другого"]),
        new("stopped", "Что мешает заниматься",
            "Что мешает заниматься грузинским?",
            ["Нет времени", "Стало сложно", "Стало скучно", "Уже не нужно"]),
        new("likes", "Что нравится",
            "Что тебе нравится в TraleBot больше всего?",
            ["Уроки", "Глаголы", "Мой словарь", "Перевод в боте"]),
        new("paywall", "Почему не купил",
            "Что остановило от покупки полного доступа?",
            ["Дорого", "Пока не нужно", "Не понял, что получу", "Другое"]),
        new("why", "Зачем грузинский",
            "Зачем тебе грузинский?",
            ["Живу в Грузии", "Собираюсь переехать", "Еду в поездку", "Просто интересно"])
    ];

    /// <summary>Answer buttons the builder offers to add by one tap.</summary>
    public static readonly IReadOnlyList<string> Suggestions =
    [
        "Другое", "Нет времени", "Дорого", "Всё устраивает", "Сложно", "Скучно", "Мало практики", "Не разобрался"
    ];
}
