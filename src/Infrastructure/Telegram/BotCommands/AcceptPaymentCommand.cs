using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class AcceptPaymentCommand : IBotCommand
{
    private TelegramBotClient _client;

    public AcceptPaymentCommand(TelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        throw new NotImplementedException();
    }

    public Task Execute(TelegramRequest request, CancellationToken token)
    {
        throw new NotImplementedException();
    }
}