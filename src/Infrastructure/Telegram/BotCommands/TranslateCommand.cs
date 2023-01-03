using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateCommand : IBotCommand
{
    private readonly TelegramBotClient _client;

    public TranslateCommand(TelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken cancellationToken)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Тут будет функция перевода на русский",
            cancellationToken: token);
    }
}