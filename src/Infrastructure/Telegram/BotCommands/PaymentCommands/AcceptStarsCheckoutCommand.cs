using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

/// <summary>
/// Handles pre_checkout_query for Telegram Stars (XTR) Pro purchase.
/// Must be registered before AcceptCheckoutCommand to intercept Stars payloads.
/// </summary>
public class AcceptStarsCheckoutCommand(ITelegramBotClient client) : IBotCommand
{
    public const string StarsProPayload = "Stars_Pro";

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(
            request.RequestType == UpdateType.PreCheckoutQuery &&
            request.InvoicePayload == StarsProPayload);
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await client.AnswerPreCheckoutQueryAsync(request.Text, cancellationToken: token);
    }
}
