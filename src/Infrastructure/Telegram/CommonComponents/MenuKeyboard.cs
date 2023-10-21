using Infrastructure.Telegram.Models;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

public static class MenuKeyboard
{
    public static IReplyMarkup GetMenuKeyboard()
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.QuizIcon} Закрепить слова"),
            },
            new []
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.VocabularyIcon} Мой словарь")
            },
            new []
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.AchievementsIcon} Достижения")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.PayIcon} Донаты"),
                InlineKeyboardButton.WithCallbackData($"{CommandNames.HelpIcon} Поддержка")
            }
        });

        return keyboard;
    }
}