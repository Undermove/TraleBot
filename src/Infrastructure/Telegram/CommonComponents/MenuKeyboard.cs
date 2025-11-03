using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

public static class MenuKeyboard
{
    public static InlineKeyboardMarkup GetMenuKeyboard(Language currentLanguage)
    {
        // Если язык грузинский, показываем специальное меню для учёбы глаголов
        if (currentLanguage == Language.Georgian)
        {
            return new InlineKeyboardMarkup(new[]
            {
                [
                    InlineKeyboardButton.WithCallbackData($"Сменить язык: {GetLanguageFlag(currentLanguage)}",
                        $"{CommandNames.ChangeCurrentLanguageMenu}")
                ],
                [
                    InlineKeyboardButton.WithCallbackData($"{CommandNames.StartVerbLearningIcon} Учиться", CommandNames.StartVerbLearning)
                ],
                [
                    InlineKeyboardButton.WithCallbackData($"{CommandNames.VerbPrefixesIcon} Приставки", CommandNames.VerbPrefixes)
                ],
                [
                    InlineKeyboardButton.WithCallbackData($"{CommandNames.ReviewHardVerbsIcon} Повторить трудные", CommandNames.ReviewHardVerbs)
                ],
                [
                    InlineKeyboardButton.WithCallbackData($"{CommandNames.VerbProgressIcon} Прогресс", CommandNames.VerbProgress)
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
        }

        // Стандартное меню для английского
        return new InlineKeyboardMarkup(new[]
        {
            [
                InlineKeyboardButton.WithCallbackData($"Сменить язык словаря: {GetLanguageFlag(currentLanguage)}",
                    $"{CommandNames.ChangeCurrentLanguageMenu}")
            ],
            [
                InlineKeyboardButton.WithCallbackData($"{CommandNames.QuizIcon} Закрепить слова", CommandNames.Quiz)
            ],
            [
                InlineKeyboardButton.WithCallbackData($"{CommandNames.VocabularyIcon} Мой словарь", CommandNames.Vocabulary)
            ],
            [
                InlineKeyboardButton.WithCallbackData($"{CommandNames.AchievementsIcon} Достижения", CommandNames.Achievements)
            ],
            [
                InlineKeyboardButton.WithCallbackData($"{CommandNames.HowToIcon} Как пользоваться", CommandNames.HowTo)
            ],
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.PayIcon} Премиум", CommandNames.Pay),
                InlineKeyboardButton.WithCallbackData($"{CommandNames.HelpIcon} Поддержка", CommandNames.Help)
            }
        });
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