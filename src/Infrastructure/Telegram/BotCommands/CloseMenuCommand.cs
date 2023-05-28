using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class CloseMenuCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public CloseMenuCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.CloseMenu, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new ReplyKeyboardRemove();

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Меню закрыто",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}