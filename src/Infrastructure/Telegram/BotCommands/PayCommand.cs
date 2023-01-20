using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.Payments;

namespace Infrastructure.Telegram.BotCommands;

public class PayCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly BotConfiguration _configuration;
    private readonly ILogger _logger;

    public PayCommand(
        TelegramBotClient client, 
        BotConfiguration configuration, 
        ILoggerFactory logger)
    {
        _client = client;
        _configuration = configuration;
        _logger = logger.CreateLogger(typeof(PayCommand));
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Pay));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        _logger.LogInformation("Payment Started");
        try
        {
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
        catch (Exception e)
        {
            _logger.LogCritical("Payment problem:", e);
        }
        // Send the invoice to the specified chat
        _logger.LogInformation("Payment Finished");
    }
}