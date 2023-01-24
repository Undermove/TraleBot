using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class QuizCommand : IBotCommand
{
    private readonly TelegramBotClient _client;

    public QuizCommand(TelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.Quiz, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData("За последнюю неделю", $"{CommandNames.Quiz} {QuizTypes.LastWeek}") },
            new[] { InlineKeyboardButton.WithCallbackData("🔓За сегодня", $"{CommandNames.Quiz} {QuizTypes.LastDay}") },
            new[] { InlineKeyboardButton.WithCallbackData("🔓10 случайных слов", $"{CommandNames.Quiz} {QuizTypes.SeveralRandomWords}") },
            new[] { InlineKeyboardButton.WithCallbackData("🔓По наиболее частым ошибкам", $"{CommandNames.Quiz} {QuizTypes.MostFailed}") },
        });

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "💬 Выбери тип квиза:",
            replyMarkup: keyboard,
            cancellationToken: token
        );
    }
}