using Application.Invoices;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

public class PayCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    
    public PayCommand(ITelegramBotClient client)
    {
        _client = client;
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
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData("💳 Месяц за 2,49€", $"{CommandNames.RequestInvoice} {SubscriptionTerm.Month}") },
            new[] { InlineKeyboardButton.WithCallbackData("💳 3 месяца за 3,99€", $"{CommandNames.RequestInvoice} {SubscriptionTerm.ThreeMonth}") },
            new[] { InlineKeyboardButton.WithCallbackData("💳 Год за 5,99€", $"{CommandNames.RequestInvoice} {SubscriptionTerm.Year}")}
        });
        
        await _client.SendTextMessageAsync(request.UserTelegramId,
            "Выбери подписку и срок подписки:",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}