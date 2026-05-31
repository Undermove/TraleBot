using Application.Common;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands;

public class NotificationsCommand(
    ITelegramBotClient client,
    ITraleDbContext db,
    ILoggerFactory loggerFactory) : IBotCommand
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<NotificationsCommand>();

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct) =>
        Task.FromResult(request.Text.StartsWith(CommandNames.Notifications));

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null)
        {
            _logger.LogWarning("Notifications command received without a user for TelegramId {TelegramId}", request.UserTelegramId);
            return;
        }

        var parts = request.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var arg = parts.Length > 1 ? parts[1].ToLowerInvariant() : string.Empty;

        string replyText;
        switch (arg)
        {
            case "off":
                request.User.NotificationsEnabled = false;
                await db.SaveChangesAsync(token);
                replyText = "Уведомления отключены. Чтобы включить снова — /notifications on";
                break;
            case "on":
                request.User.NotificationsEnabled = true;
                await db.SaveChangesAsync(token);
                replyText = "Уведомления включены. Чтобы отключить — /notifications off";
                break;
            default:
                replyText = "Используй /notifications on или /notifications off";
                break;
        }

        await client.SendTextMessageAsync(
            request.UserTelegramId,
            replyText,
            parseMode: ParseMode.Html,
            cancellationToken: token);
    }
}
