using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

/// <summary>
/// What a brand-new person hears from Bombora before the mini-app is opened: the one message after
/// /start and the one reminder a day later. Both carry a single button that opens the mini-app,
/// where a newcomer lands on the first step (level choice → the one-letter welcome lesson).
/// The promise is exactly what that lesson gives: one letter — how it looks, sounds and is called.
/// </summary>
public static class FirstStepMessage
{
    public const string ButtonLabel = "🚀 Узнать первую букву";
    public const string VerbsButtonLabel = "🚀 Открыть «Глаголы»";

    public const string TrialLine = "Первые 30 дней — всё бесплатно.";
    public const string ReferralTrialLine = "Тебе бонус за приглашение: 60 дней бесплатно вместо 30 🎁";

    public const string Promise =
        "Одна минута — и ты узнаешь первую грузинскую букву: как она выглядит, как звучит и как называется.";

    /// <summary>The link led to the «Глаголы» section: the button opens it, so the letter is not promised.</summary>
    public const string VerbsPromise = "По кнопке ниже — раздел «Глаголы».";

    /// <summary>The mini-app is switched off in this environment: there is no button to promise anything about.</summary>
    public const string NoMiniAppPromise = "Напиши мне любое слово или фразу — переведу и добавлю в твой словарь.";

    public const string ReminderText =
        "Это Бомбора 🐶 Первая грузинская буква всё ещё ждёт тебя — это одна минута. Заглянешь?";

    public static string WelcomeText(string userName, bool referralBonus, bool verbsSection = false, bool miniApp = true)
    {
        var promise = !miniApp ? NoMiniAppPromise : verbsSection ? VerbsPromise : Promise;
        return $"""
                გამარჯობა, {userName}! 👋 Это «гамарджоба» — «привет» по-грузински.

                Я Бомбора 🐶, помогу тебе с грузинским. {promise}

                {(referralBonus ? ReferralTrialLine : TrialLine)}
                """;
    }

    /// <summary>The single button under the first message and the reminder.</summary>
    public static InlineKeyboardMarkup Keyboard(string miniAppUrl, bool verbsSection = false) =>
        new(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp(
                    verbsSection ? VerbsButtonLabel : ButtonLabel,
                    new WebAppInfo { Url = miniAppUrl })
            }
        });
}
