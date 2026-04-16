using Application.MiniApp.Commands;
using Infrastructure.Monitoring;
using Infrastructure.Telegram.Models;
using MediatR;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

/// <summary>
/// Handles successful_payment for Telegram Stars (XTR) — activates Pro for the user.
/// </summary>
public class ActivateProOnStarsPaymentCommand(
    ITelegramBotClient client,
    IMediator mediator,
    MonetizationMetrics metrics,
    ILoggerFactory loggerFactory) : IBotCommand
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<ActivateProOnStarsPaymentCommand>();

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(
            request.RequestType == UpdateType.Message &&
            request.SuccessfulPaymentCurrency == "XTR");
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null)
        {
            _logger.LogWarning("Stars payment received but user is null for TelegramId {TelegramId}",
                request.UserTelegramId);
            return;
        }

        var result = await mediator.Send(
            new ActivateProStars
            {
                UserId = request.User.Id,
                Payload = request.SuccessfulPaymentPayload,
                ChargeId = request.SuccessfulPaymentChargeId,
                Amount = request.SuccessfulPaymentAmount,
                Currency = request.SuccessfulPaymentCurrency
            },
            token);

        switch (result)
        {
            case ActivateProStarsResult.Success:
                metrics.PurchaseSucceeded.Add(1, new KeyValuePair<string, object?>(
                    "payload", request.SuccessfulPaymentPayload ?? "unknown"));
                _logger.LogInformation("Pro activated via Stars for user {UserId}", request.User.Id);
                await client.SendTextMessageAsync(
                    request.UserTelegramId,
                    "⭐ Про-доступ активирован! Все модули мини-аппа открыты.\n\nვარსკვლავი = звезда",
                    cancellationToken: token);
                break;

            case ActivateProStarsResult.AlreadyPro:
                _logger.LogInformation("User {UserId} already has Pro, Stars payment received", request.User.Id);
                break;

            case ActivateProStarsResult.UserNotFound:
                _logger.LogWarning("User {UserId} not found for Stars payment", request.User.Id);
                break;
        }
    }
}
