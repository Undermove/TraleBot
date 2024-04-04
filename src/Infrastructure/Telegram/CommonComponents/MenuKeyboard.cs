using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

public static class MenuKeyboard
{
    public static InlineKeyboardMarkup GetMenuKeyboard(Language currentLanguage)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            [
                InlineKeyboardButton.WithCallbackData($"Сменить язык словаря: {GetLanguageFlag(currentLanguage)}",
                    $"{CommandNames.ChangeCurrentLanguageMenu}")
            ],
            [
                InlineKeyboardButton.WithCallbackData($"{CommandNames.QuizIcon} Закрепить слова")
            ],
            [
                InlineKeyboardButton.WithCallbackData($"{CommandNames.VocabularyIcon} Мой словарь")
            ],
            [
                InlineKeyboardButton.WithCallbackData($"{CommandNames.AchievementsIcon} Достижения")
            ],
            [
                InlineKeyboardButton.WithCallbackData($"{CommandNames.HowToIcon} Как пользоваться", CommandNames.HowTo)
            ],
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.PayIcon} Премиум"),
                InlineKeyboardButton.WithCallbackData($"{CommandNames.HelpIcon} Поддержка")
            }
        });
        

        return keyboard;
    }

    public static string GetLanguageFlag(this Language language)
    {
        return language switch
        {
            Language.English => "🇬🇧",
            Language.Georgian => "🇬🇪",
            _ => "🇬🇧"
        };
    }
}