using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class GeorgianLevelsMenuCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public GeorgianLevelsMenuCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.GeorgianLevelsMenu, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new InlineKeyboardButton[][]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("1️⃣ 🇬🇪 A1 — Буквы и основы речи", CommandNames.GeorgianA1)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("2️⃣ 🇬🇪 A2 — Простые фразы и глаголы движения", CommandNames.GeorgianA2)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("3️⃣ 🇬🇪 B1 — Разговорный уровень", CommandNames.GeorgianB1)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("4️⃣ 🇬🇪 B2 — Продвинутая грамматика", CommandNames.GeorgianB2)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("5️⃣ 🇬🇪 C1 — Идиомы и речь как у носителя", CommandNames.GeorgianC1)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("❌ Назад в меню", "/menu")
            }
        });

        await _client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}