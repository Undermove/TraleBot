using Application.Common.Interfaces;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.Services;

public class TelegramNotificationService: IUserNotificationService
{
    private readonly ITelegramBotClient _client;

    public TelegramNotificationService(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task SendDailyReturnPushAsync(long telegramId, string moduleName, string moduleId, int lessonId, string variant, CancellationToken ct)
    {
        throw new NotImplementedException();
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
        
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📊Посмотреть все достижения", $"{CommandNames.Achievements}")
            }
        });
        
        await _client.SendTextMessageAsync(
            userTelegramId,
            $"{achievement.Icon}{achievement.Name} – {achievement.Description}",
            replyMarkup: keyboard,
            cancellationToken: ct);
    }
}