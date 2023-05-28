using Application.Invoices;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

public class AcceptCheckoutCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public AcceptCheckoutCommand(
        ITelegramBotClient client,
        IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(request.RequestType == UpdateType.PreCheckoutQuery);
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var isParsed = Enum.TryParse<SubscriptionTerm>(request.InvoicePayload, out var subscriptionTerm);
        if (!isParsed)
        {
            throw new ApplicationException("Invoice payload incorrect");
        }
        
        await _mediator.Send(new ProcessPaymentCommand
        {
            UserId = request.User!.Id, 
            PreCheckoutQueryId = request.Text,
            SubscriptionTerm = subscriptionTerm
        }, token);
        await _client.AnswerPreCheckoutQueryAsync(request.Text, token);
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "✅Платеж принят. Спасибо за поддержку нашего бота! Вам доступны дополнительные фичи.",
            cancellationToken: token);
    }
}