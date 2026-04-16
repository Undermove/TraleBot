using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

public static class MenuKeyboard
{
    public static InlineKeyboardMarkup GetMenuKeyboard(Language currentLanguage, string miniAppUrl = null, bool isOwner = false)
    {
        var buttons = new List<InlineKeyboardButton[]>();

        if (isOwner)
        {
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData($"Сменить язык словаря: {GetLanguageFlag(currentLanguage)}",
                    $"{CommandNames.ChangeCurrentLanguageMenu}")
            });
        }

        buttons.Add(new[] { InlineKeyboardButton.WithCallbackData($"{CommandNames.QuizIcon} Закрепить слова") });
        buttons.Add(new[] { InlineKeyboardButton.WithCallbackData($"{CommandNames.VocabularyIcon} Мой словарь") });
        buttons.Add(new[] { InlineKeyboardButton.WithCallbackData($"{CommandNames.AchievementsIcon} Достижения") });
        
        // Add Georgian repetition modules button only for Georgian language
        if (currentLanguage == Language.Georgian)
        {
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("📦 Модули повторения", 
                    CommandNames.GeorgianRepetitionModules)
            });
        }
        
        // Mini-app button — opens TraleBot mini-app (Бомбора is the mascot inside) in a WebApp overlay
        if (!string.IsNullOrEmpty(miniAppUrl))
        {
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithWebApp("🚀 Открыть TraleBot",
                    new WebAppInfo { Url = miniAppUrl })
            });
        }

        buttons.Add(new[]
        {
            InlineKeyboardButton.WithCallbackData($"{CommandNames.HowToIcon} Как пользоваться", CommandNames.HowTo)
        });
        
        // "Buy subscription" — opens the mini-app directly to the paywall.
        // Falls back to a callback if mini-app isn't available.
        if (!string.IsNullOrEmpty(miniAppUrl))
        {
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithWebApp("💳 Оплатить подписку",
                    new WebAppInfo { Url = $"{miniAppUrl}?paywall=1" }),
                InlineKeyboardButton.WithCallbackData($"{CommandNames.HelpIcon} Поддержка", CommandNames.Help)
            });
        }
        else
        {
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.HelpIcon} Поддержка", CommandNames.Help)
            });
        }
        
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