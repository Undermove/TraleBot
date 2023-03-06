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
        return Task.FromResult(commandPayload.Equals(CommandNames.Quiz, StringComparison.InvariantCultureIgnoreCase) ||
                               commandPayload.StartsWith(CommandNames.QuizIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        string PayLabel(string label) => request.User!.IsActivePremium() ? label : "🔓";
        var payCommand = request.User!.IsActivePremium() ? $"{CommandNames.Quiz}" : $"{CommandNames.OfferTrial}";
        
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData("🌗 За последнюю неделю", $"{CommandNames.Quiz} {QuizTypes.LastWeek}") },
            new[] { InlineKeyboardButton.WithCallbackData($"{PayLabel("📅")} За сегодня", $"{payCommand} {QuizTypes.LastDay}") },
            new[] { InlineKeyboardButton.WithCallbackData($"{PayLabel("🎲")} 10 случайных слов", $"{payCommand} {QuizTypes.SeveralRandomWords}") },
            new[] { InlineKeyboardButton.WithCallbackData($"{PayLabel("🥈")} Закрепить новые", $"{payCommand} {QuizTypes.MostFailed}") },
            new[] { InlineKeyboardButton.WithCallbackData($"{PayLabel("🥇")} Закрепить в обратном направлении", $"{payCommand} {QuizTypes.ReverseDirection}") },
        });

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "💬 Выбери тип квиза:",
            replyMarkup: keyboard,
            cancellationToken: token
        );
    }
}