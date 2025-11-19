using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.GeorgianModule.VerbsOfMovement;

public class GeorgianVerbsOfMovementCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public GeorgianVerbsOfMovementCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.GeorgianVerbsOfMovement, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new InlineKeyboardButton[][]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 1. Знакомство с глаголами движения", CommandNames.GeorgianVerbsLesson1)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 2. Приставки направления", CommandNames.GeorgianVerbsLesson2)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 3. Спряжение настоящего времени", CommandNames.GeorgianVerbsLesson3)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 4. Закрепление настоящего времени", CommandNames.GeorgianVerbsLesson4)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 5. Прошедшее время (основы)", CommandNames.GeorgianVerbsLesson5)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 6. Склонения прошедшего времени", CommandNames.GeorgianVerbsLesson6)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 7. Закрепление прошедшего", CommandNames.GeorgianVerbsLesson7)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 8. Будущее время (основы)", CommandNames.GeorgianVerbsLesson8)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 9. Склонения будущего времени", CommandNames.GeorgianVerbsLesson9)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 10. Закрепление настоящего прошедшего и будущего", CommandNames.GeorgianVerbsLesson10)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📖 Урок 11. Глаголы движения в прошедшем несовершённом времени", CommandNames.GeorgianVerbsLesson11)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("⬅️ Назад", CommandNames.GeorgianRepetitionModules)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🏠 В главное меню", "/menu")
            }
        });

        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "🚶 Глаголы движения",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}