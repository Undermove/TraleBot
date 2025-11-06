using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.GeorgianModule;

public class GeorgianRepetitionModulesCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public GeorgianRepetitionModulesCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.GeorgianRepetitionModules, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new InlineKeyboardButton[][]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🚶 Глаголы движения", CommandNames.GeorgianVerbsOfMovement)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("👤 Местоимения", CommandNames.GeorgianPronouns)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("❌ Назад в меню", "/menu")
            }
        });

        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "📦 Выбери, что хочешь закрепить:",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}