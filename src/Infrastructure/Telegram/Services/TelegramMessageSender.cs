using Application.Admin;
using Infrastructure.Telegram;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.Services;

public class TelegramMessageSender(
    ITelegramBotClient bot,
    BotConfiguration config,
    ILoggerFactory loggerFactory) : ITelegramMessageSender
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<TelegramMessageSender>();

    public async Task<bool> SendTextAsync(long telegramId, string text, bool includeMiniAppButton, CancellationToken ct)
    {
        try
        {
            InlineKeyboardMarkup? keyboard = null;
            if (includeMiniAppButton
                && config.MiniAppEnabled
                && !string.IsNullOrEmpty(config.HostAddress))
            {
                keyboard = new InlineKeyboardMarkup(new[]
                {
                    InlineKeyboardButton.WithWebApp(
                        "🚀 Открыть TraleBot",
                        new WebAppInfo { Url = $"{config.NormalizedHost()}/" })
                });
            }

            await bot.SendTextMessageAsync(
                telegramId, text, replyMarkup: keyboard, cancellationToken: ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send broadcast to {TelegramId}", telegramId);
            return false;
        }
    }
}
