using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.Payments;

namespace Infrastructure.Telegram.BotCommands;

public class PayCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly BotConfiguration _configuration;

    public PayCommand(TelegramBotClient client, BotConfiguration configuration)
    {
        _client = client;
        _configuration = configuration;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Pay));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        // Send the invoice to the specified chat
        await _client.SendInvoiceAsync(
            request.UserTelegramId,
            "Payment",
            "Extended TraleBot",
            "somePayload",
            _configuration.PaymentProviderToken,
            "GEL",
            new List<LabeledPrice> {new("Premium", 20*100)},
            cancellationToken: token
        );
    }
}