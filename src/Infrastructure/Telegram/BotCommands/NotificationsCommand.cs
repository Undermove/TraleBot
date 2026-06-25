using Application.Common;
using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

/// <summary>
/// Bot-command shortcut to flip <see cref="Domain.Entities.User.NotificationsEnabled"/>
/// without opening the mini-app. Recognises `/notifications`, `/notifications on`
/// and `/notifications off` (second word is case-insensitive). All dispatchers
/// (`DailyReturnNotificationService` and future holiday/coins/streak) already gate
/// on the same flag, so flipping it here is enough to opt the user in or out.
/// </summary>
public class NotificationsCommand(ITelegramBotClient client, ITraleDbContext db) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var text = request.Text?.Trim() ?? string.Empty;
        if (text.Equals(CommandNames.Notifications, StringComparison.InvariantCultureIgnoreCase))
        {
            return Task.FromResult(true);
        }
        return Task.FromResult(text.StartsWith(CommandNames.Notifications + " ", StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null)
        {
            return;
        }

        var argument = ParseArgument(request.Text);
        string responseText;

        switch (argument)
        {
            case "off":
                request.User.NotificationsEnabled = false;
                await db.SaveChangesAsync(token);
                responseText = "Уведомления отключены. Включить: /notifications on";
                break;
            case "on":
                request.User.NotificationsEnabled = true;
                await db.SaveChangesAsync(token);
                responseText = "Уведомления включены. Отключить: /notifications off";
                break;
            default:
                var state = request.User.NotificationsEnabled ? "включены" : "отключены";
                responseText = $"Уведомления сейчас: {state}. Изменить: /notifications off или /notifications on";
                break;
        }

        await client.SendTextMessageAsync(
            request.UserTelegramId,
            responseText,
            cancellationToken: token);
    }

    private static string ParseArgument(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var parts = text.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2) return string.Empty;
        return parts[1].Trim().ToLowerInvariant();
    }
}
