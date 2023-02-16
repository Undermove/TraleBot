using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

public class OfferTrialCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly ILogger _logger;

    public OfferTrialCommand(TelegramBotClient client, ILoggerFactory logger)
    {
        _client = client;
        _logger = logger.CreateLogger(typeof(PayCommand));
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.OfferTrial, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        _logger.LogInformation("User with ID: {id} requested invoice", request.User!.Id);

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData("✅ Пробная на месяц. (карта не нужна)", $"{CommandNames.ActivateTrial}") },
            new[] { InlineKeyboardButton.WithCallbackData("💳 Купить подписку.", $"{CommandNames.Pay}") }
        });
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId, 
            "Эта функция недоступна для бесплатной версии, но вы можете взять пробную версию бота на месяц." +
            "\r\nСуществование платной версии помогает нам развивать бесплатные функции бота и оплачивать сервер для его работы.",
            replyMarkup: keyboard,
            cancellationToken: token);
        
        _logger.LogInformation("Invoice sent to user with ID: {id}", request.User!.Id);
    }
}