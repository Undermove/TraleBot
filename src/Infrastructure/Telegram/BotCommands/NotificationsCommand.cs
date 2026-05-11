using Application.Common;
using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class NotificationsCommand(ITelegramBotClient client, ITraleDbContext db) : IBotCommand
{
    private const string OffReply = "Уведомления отключены. Включить: /notifications on";
    private const string OnReply = "Уведомления включены. Отключить: /notifications off";
    private const string UsageHint = "Используй /notifications on или /notifications off";

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(
            request.Text.StartsWith(CommandNames.Notifications, StringComparison.OrdinalIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null) return;

        var parts = request.Text.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var arg = parts.Length > 1 ? parts[1].Trim() : string.Empty;

        string replyText;
        if (arg.Equals("off", StringComparison.OrdinalIgnoreCase))
        {
            request.User.NotificationsEnabled = false;
            await db.SaveChangesAsync(token);
            replyText = OffReply;
        }
        else if (arg.Equals("on", StringComparison.OrdinalIgnoreCase))
        {
            request.User.NotificationsEnabled = true;
            await db.SaveChangesAsync(token);
            replyText = OnReply;
        }
        else
        {
            replyText = UsageHint;
        }

        await client.SendTextMessageAsync(request.UserTelegramId, replyText, cancellationToken: token);
    }
}
