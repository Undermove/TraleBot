using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

public class OfferTrialCommand(ITelegramBotClient client) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.OfferTrial, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        // todo: if user subscription ends then offer only buy button
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData("✅ Пробная на месяц. (карта не нужна)", $"{CommandNames.ActivateTrial}") },
            new[] { InlineKeyboardButton.WithCallbackData("💳 Купить подписку.", $"{CommandNames.Pay}") }
        });
        
        await client.SendTextMessageAsync(
            request.UserTelegramId, 
            "Эта функция недоступна для бесплатной версии, но вы можете взять пробную версию бота на месяц." +
            "\r\nСуществование платной версии помогает нам развивать бесплатные функции бота и оплачивать сервер для его работы.",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}