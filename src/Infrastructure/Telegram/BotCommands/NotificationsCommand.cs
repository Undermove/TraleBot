using Application.Common;
using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class NotificationsCommand(ITelegramBotClient client, ITraleDbContext db) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(
            request.Text.StartsWith(CommandNames.Notifications, StringComparison.OrdinalIgnoreCase));
    }

    public Task Execute(TelegramRequest request, CancellationToken token)
    {
        // stub — not yet implemented
        return Task.CompletedTask;
    }
}
