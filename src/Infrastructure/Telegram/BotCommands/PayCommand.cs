using Application.Invoices;
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
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.Pay, StringComparison.InvariantCultureIgnoreCase) || 
            commandPayload.StartsWith(CommandNames.PayIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        _logger.LogInformation("User with ID: {id} requested invoice", request.User!.Id);

        await _client.SendTextMessageAsync(request.UserTelegramId,
            "Выбери подписку и срок подписки:", 
            cancellationToken: token);
        
        var prices = new List<LabeledPrice>
        {
            new("Месяц за 2,49€", 249),
            new("3 месяца за 3,99€", 389),
            new("Год за 5,99€", 599)
        };
        var counter = 0;
        foreach (var price in prices)
        {
            var paymentType = ((SubscriptionTerm)counter++).ToString();
            
            await _client.SendInvoiceAsync(
                request.UserTelegramId,
                price.Label,
                "Расширенный функционал",
                paymentType,
                _configuration.PaymentProviderToken,
                "EUR",
                new List<LabeledPrice>
                {
                    price
                },
                cancellationToken: token
            );
        }
        
        _logger.LogInformation("Invoice sent to user with ID: {id}", request.User!.Id);
    }
}