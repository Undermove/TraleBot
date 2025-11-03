using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

public static class MenuKeyboard
{
    public static InlineKeyboardMarkup GetMenuKeyboard(Language currentLanguage)
    {
        var buttons = new List<InlineKeyboardButton[]>
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"Сменить язык словаря: {GetLanguageFlag(currentLanguage)}",
                    $"{CommandNames.ChangeCurrentLanguageMenu}")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.QuizIcon} Закрепить слова")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.VocabularyIcon} Мой словарь")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.AchievementsIcon} Достижения")
            }
        };
        
        // Add Georgian language learning button only for Georgian language
        if (currentLanguage == Language.Georgian)
        {
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("🇬🇪 Учить грузинский от A1 до С2", 
                    CommandNames.GeorgianLevelsMenu)
            });
        }
        
        buttons.Add(new[]
        {
            InlineKeyboardButton.WithCallbackData($"{CommandNames.HowToIcon} Как пользоваться", CommandNames.HowTo)
        });
        
        buttons.Add(new[]
        {
            InlineKeyboardButton.WithCallbackData($"{CommandNames.PayIcon} Премиум"),
            InlineKeyboardButton.WithCallbackData($"{CommandNames.HelpIcon} Поддержка")
        });
        
        var keyboard = new InlineKeyboardMarkup(buttons);
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