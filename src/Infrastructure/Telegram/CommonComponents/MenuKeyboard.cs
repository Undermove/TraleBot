using Infrastructure.Telegram.Models;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

public static class MenuKeyboard
{
    public static IReplyMarkup GetMenuKeyboard()
    {
        var keyboard = new ReplyKeyboardMarkup(new[]
        {
            new[]
            {
                new KeyboardButton($"{CommandNames.QuizIcon} Квиз"),
                new KeyboardButton($"{CommandNames.StopQuizIcon} Остановить квиз"),
                new KeyboardButton($"{CommandNames.VocabularyIcon} Мой словарь")
            },
            new[]
            {
                new KeyboardButton($"{CommandNames.PayIcon} Премиум"),
                new KeyboardButton($"{CommandNames.HelpIcon} Поддержка"),
                new KeyboardButton($"{CommandNames.CloseMenu} Закрыть меню")
            }
        });
        keyboard.ResizeKeyboard = true;

        return keyboard;
    }
}