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
            [
                InlineKeyboardButton.WithCallbackData("🇬🇧 Английский", $"{callbackData} {Language.English}")
            ],
            new []
            {
                InlineKeyboardButton.WithCallbackData("🇬🇪 Грузинский", $"{callbackData} {Language.Georgian}"),
            }
        });

        return keyboard;
    }
}