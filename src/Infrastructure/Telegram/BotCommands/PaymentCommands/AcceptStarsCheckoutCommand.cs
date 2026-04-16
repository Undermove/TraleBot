using Application.MiniApp;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

/// <summary>
/// Handles pre_checkout_query for Telegram Stars (XTR) Pro purchase.
/// Accepts all Stars_Pro_* payloads (Month/Quarter/HalfYear/Year/Lifetime).
/// Must be registered before AcceptCheckoutCommand to intercept Stars payloads.
/// </summary>
public class AcceptStarsCheckoutCommand(ITelegramBotClient client) : IBotCommand
{
    // Legacy payload for existing bot command flow — keeps backward compatibility.
    public const string StarsProPayload = "Stars_Pro";

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(
            request.RequestType == UpdateType.PreCheckoutQuery &&
            SubscriptionPlans.IsStarsPayload(request.InvoicePayload));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await client.AnswerPreCheckoutQueryAsync(request.Text, cancellationToken: token);
    }
}
