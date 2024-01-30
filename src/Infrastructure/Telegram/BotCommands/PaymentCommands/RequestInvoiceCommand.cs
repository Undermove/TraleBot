using Application.Invoices;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.Payments;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

public class RequestInvoiceCommand(
    ITelegramBotClient client,
    BotConfiguration configuration,
    ILoggerFactory logger)
    : IBotCommand
{
    private readonly ILogger _logger = logger.CreateLogger(typeof(PayCommand));
    private static readonly Dictionary<SubscriptionTerm, LabeledPrice> Prices = new()
    {
        {SubscriptionTerm.Month, new("Месяц за 2,49€", 249)},
        {SubscriptionTerm.ThreeMonth, new("3 месяца за 3,99€", 389)},
        {SubscriptionTerm.Year, new("Год за 5,99€", 599)}
    };

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

        await client.SendInvoiceAsync(
            request.UserTelegramId,
            Prices[subscriptionTerm].Label,
            "Премиум аккаунт",
            subscriptionTerm.ToString(),
            configuration.PaymentProviderToken,
            "EUR",
            new List<LabeledPrice>
            {
                Prices[subscriptionTerm]
            },
            cancellationToken: token
        );
        
        _logger.LogInformation("Invoice sent to user with ID: {id}", request.User!.Id);
    }
}