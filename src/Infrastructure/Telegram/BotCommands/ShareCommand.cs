using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

/// <summary>
/// /share — returns a personal referral link so the user can invite friends.
/// No DB changes: the link is just t.me/{botName}?start=ref_{telegramId}.
/// </summary>
public class ShareCommand(ITelegramBotClient client, BotConfiguration botConfig) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
        => Task.FromResult(request.Text.Equals(CommandNames.Share, StringComparison.OrdinalIgnoreCase));

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var userId = request.UserTelegramId;
        var botName = botConfig.BotName;
        var referralLink = $"https://t.me/{botName}?start=ref_{userId}";

        // Telegram share URL — opens the native share sheet in any Telegram client.
        var shareUrl = $"https://t.me/share/url?url={Uri.EscapeDataString(referralLink)}";

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithUrl("Поделиться 🔗", shareUrl) }
        });

        await client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Поделись Бомборой с другом:\n\n" +
            $"👇 Твоя ссылка:\n" +
            $"t.me/{botName}?start=ref_{userId}\n\n" +
            $"Или просто перешли это сообщение 👆",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}
