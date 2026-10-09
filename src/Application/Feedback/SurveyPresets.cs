using System.Collections.Generic;
using System.Linq;
using Domain.Entities;

namespace Application.Feedback;

/// <summary>
/// A ready-made survey form for the owner's survey builder: the questions and their answers are
/// already written, so a survey can be sent without typing anything.
/// </summary>
/// <param name="Id">Latin, lower case — becomes a part of the campaign key (<c>survey-2026-10-users</c>).</param>
/// <param name="Title">What the card in the builder is called.</param>
/// <param name="About">Whom the form is for, in a line.</param>
public record SurveyPreset(string Id, string Title, string About, SurveyForm Form);

/// <summary>
/// The questions ask about facts and the past, not about wishes; nothing is asked that the
/// database already shows (which sections a person uses); "left TraleBot" and "left the language"
/// are told apart. Wording avoids grammatical gender where it reads naturally and uses the
/// mini-app's "(а)" where it does not.
/// </summary>
public static class SurveyPresets
{
    /// <summary>The longest caption that still fits one inline button on a phone without being cut —
    /// for the first question, whose options are buttons in the chat.</summary>
    public const int MaxButtonLength = 24;

    /// <summary>Id of a survey the owner builds from scratch.</summary>
    public const string Custom = "custom";

    public const string Intro = "Привет! Это автор TraleBot. Помоги сделать его лучше — ответь на несколько коротких вопросов.";

    private static SurveyQuestion Choice(string text, bool other, params string[] options) =>
        new() { Text = text, Kind = SurveyQuestionKind.Choice, Options = [.. options], AllowOther = other };

    private static SurveyQuestion Free(string text) => new() { Text = text, Kind = SurveyQuestionKind.Text };

    // ── Тем, кто пользуется ──
    private static readonly SurveyQuestion IfGone = new()
    {
        Text = "Что ты почувствуешь, если TraleBot завтра исчезнет?", Kind = SurveyQuestionKind.Choice,
        Options = ["Очень расстроюсь", "Немного расстроюсь", "Мне всё равно", "Уже не пользуюсь"],
        OptionKeys = ["very", "somewhat", "indifferent", "unused"],
        HeadlineOption = "very", HeadlineWithout = "unused"
    };
    private static readonly SurveyQuestion WhatElseNow = Choice("Чем ещё ты пользуешься для грузинского?", true,
        "Репетитор или курсы", "Другие приложения", "Учебник или YouTube", "Только TraleBot");
    private static readonly SurveyQuestion WhyGeorgian = Choice("Зачем тебе грузинский?", true,
        "Живу в Грузии", "Собираюсь переехать", "Еду в поездку", "Семья или близкие", "Просто интересно");
    private static readonly SurveyQuestion LastHelped = Free("Вспомни последний раз, когда TraleBot тебе реально помог. Что это было?");
    private static readonly SurveyQuestion LastAnnoyed = Free("А что в последний раз раздражало или мешало?");

    // ── Тем, кто перестал ──
    private static readonly SurveyQuestion LearningNow = Choice("Ты сейчас учишь грузинский?", false,
        "Да, другим способом", "Пауза, вернусь", "Нет, бросил(а)", "Он мне больше не нужен");
    private static readonly SurveyQuestion AfterWhat = Choice("После чего ты перестал(а) открывать TraleBot?", true,
        "Не было времени", "Стало слишком сложно", "Стало скучно", "Закончился бесплатный доступ", "Не помню");
    private static readonly SurveyQuestion WhatElseThen = Choice("Что ещё, кроме TraleBot, помогало тебе с грузинским?", true,
        "Репетитор или курсы", "Другие приложения", "Учебник или YouTube", "Ничего");
    private static readonly SurveyQuestion Goal = Choice("Чего хотелось добиться в самом начале?", true,
        "Читать вывески и меню", "Объясняться в быту", "Свободно разговаривать", "Понять, как устроен язык");
    private static readonly SurveyQuestion Disliked = Free("Что тебе не понравилось в TraleBot? Пиши как есть.");

    // ── Тем, кто платил ──
    public const string PaidIntro = "Привет! Это автор TraleBot. Ты один из немногих, кто оформил подписку, и мне очень важно твоё мнение. Это пять коротких вопросов.";
    private static readonly SurveyQuestion WhyBought = Free("Вспомни день, когда ты оформил(а) подписку. Что тогда подтолкнуло?");
    private static readonly SurveyQuestion WhyNotRenewed = Choice("Если подписка у тебя закончилась — почему не продлил(а)?", true,
        "Подписка действует", "Перестал(а) заниматься", "Хватает бесплатного", "Дорого", "Просто забыл(а)");

    // ── Только в банке ──
    private static readonly SurveyQuestion Paywall = Choice("Что остановило от покупки полного доступа?", true,
        "Дорого", "Пока не нужно", "Не понял, что получу");

    public static readonly IReadOnlyList<SurveyPreset> All =
    [
        new("users", "Тем, кто пользуется", "Насколько TraleBot нужен, чем ещё занимаются и что помогает",
            Form(IfGone, WhatElseNow, WhyGeorgian, LastHelped, LastAnnoyed)),
        new("left", "Тем, кто перестал", "Ушли от TraleBot или от языка, после чего и чего хотели",
            Form(LearningNow, AfterWhat, WhatElseThen, Goal, Disliked)),
        new("paid", "Тем, кто платил", "Что подтолкнуло оформить подписку, что помогает и почему не продлили",
            new SurveyForm { Intro = PaidIntro, Questions = [IfGone, WhyBought, LastHelped, LastAnnoyed, WhyNotRenewed] })
    ];

    /// <summary>Ready questions the builder offers to add to a form: everything from the forms above and one more.</summary>
    public static readonly IReadOnlyList<SurveyQuestion> Bank =
    [
        IfGone, WhatElseNow, WhyGeorgian, LastHelped, LastAnnoyed,
        LearningNow, AfterWhat, WhatElseThen, Goal, Disliked, WhyBought, WhyNotRenewed, Paywall
    ];

    /// <summary>Answer buttons the builder offers to add by one tap.</summary>
    public static readonly IReadOnlyList<string> Suggestions =
    [
        "Нет времени", "Дорого", "Всё устраивает", "Сложно", "Скучно", "Мало практики", "Не помню", "Не знаю"
    ];

    private static SurveyForm Form(params SurveyQuestion[] questions) => new() { Intro = Intro, Questions = [.. questions] };
}
