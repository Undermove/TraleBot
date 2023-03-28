using Application.Common.Interfaces;
using Domain.Entities;
using Telegram.Bot;

namespace Infrastructure.Telegram.Services;

public class TelegramNotificationService: IUserNotificationService
{
    private readonly TelegramBotClient _client;

    public TelegramNotificationService(TelegramBotClient client)
    {
        _client = client;
    }

    public async Task NotifyAboutUnlockedAchievementAsync(Achievement achievement, CancellationToken ct)
    {
        await _client.SendTextMessageAsync(
            achievement.User.TelegramId,
            "✅Платеж принят. Спасибо за поддержку нашего бота! Вам доступны дополнительные фичи.",
            cancellationToken: ct);
    }
}