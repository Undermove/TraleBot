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
        var userTelegramId = achievement.User.TelegramId;
        
        await _client.SendTextMessageAsync(
            userTelegramId,
            "✅Открыто новое достижение!",
            cancellationToken: ct);
        
        await _client.SendTextMessageAsync(
            userTelegramId,
            achievement.Icon,
            cancellationToken: ct);
        
        await _client.SendTextMessageAsync(
            userTelegramId,
            $"{achievement.Name} – {achievement.Description}",
            cancellationToken: ct);
    }
}