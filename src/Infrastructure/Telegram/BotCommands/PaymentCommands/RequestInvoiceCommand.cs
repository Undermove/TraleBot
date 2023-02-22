using Application.Invoices;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.Payments;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

public class RequestInvoiceCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly BotConfiguration _configuration;
    private readonly ILogger _logger;
    private static readonly Dictionary<SubscriptionTerm, LabeledPrice> _prices = new()
    {
        {SubscriptionTerm.Month, new("Месяц за 2,49€", 249)},
        {SubscriptionTerm.ThreeMonth, new("3 месяца за 3,99€", 389)},
        {SubscriptionTerm.Year, new("Год за 5,99€", 599)}
    };

    public RequestInvoiceCommand(
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
            commandPayload.StartsWith(CommandNames.RequestInvoice, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        _logger.LogInformation("User with ID: {id} requested invoice", request.User!.Id);

        var subscriptionTerm = Enum.Parse<SubscriptionTerm>(request.Text.Split(' ')[1]);

        await _client.SendInvoiceAsync(
            request.UserTelegramId,
            _prices[subscriptionTerm].Label,
            "Расширенный функционал",
            subscriptionTerm.ToString(),
            _configuration.PaymentProviderToken,
            "EUR",
            new List<LabeledPrice>
            {
                _prices[subscriptionTerm]
            },
            cancellationToken: token
        );
        
        _logger.LogInformation("Invoice sent to user with ID: {id}", request.User!.Id);
    }
}