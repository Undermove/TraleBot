using Application.Invoices;
using Infrastructure.Telegram.Models;
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
            new[] { InlineKeyboardButton.WithCallbackData("💳 Американо: 2,49€", $"{CommandNames.RequestInvoice} {SubscriptionTerm.Month}") },
            new[] { InlineKeyboardButton.WithCallbackData("💳 Капучино: 3,99€", $"{CommandNames.RequestInvoice} {SubscriptionTerm.ThreeMonth}") },
            new[] { InlineKeyboardButton.WithCallbackData("💳 Кокосовый раф: 5,99€", $"{CommandNames.RequestInvoice} {SubscriptionTerm.Year}")}
        });
        
        await _client.SendTextMessageAsync(request.UserTelegramId,
            "☕️ Если вам понравился бот, то вы можете купить мне кофе.",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}