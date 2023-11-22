using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.CommonComponents;

public static class LanguageKeyboard
{
    public static InlineKeyboardMarkup GetLanguageKeyboard(string callbackData)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🇬🇧 Английский", callbackData)
            },
            new []
            {
                InlineKeyboardButton.WithCallbackData("🇬🇪 Грузинский", callbackData)
            }
        });

        return keyboard;
    }
}