using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.Payments;

namespace Infrastructure.Telegram.BotCommands;

public class AcceptCheckoutCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly BotConfiguration _configuration;
    private readonly ILogger _logger;

    public AcceptCheckoutCommand(
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
        return Task.FromResult(request.RequestType == UpdateType.PreCheckoutQuery);
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await _client.AnswerPreCheckoutQueryAsync(request.Text, token);
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "✅Платеж принят. Спасибо за поддержку нашего бота! Вам досутпны дополнительные фичи.",
            cancellationToken: token);
    }
}