using Application.Common.Interfaces;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;
using DomainUser = Domain.Entities.User;
using Achievement = Domain.Entities.Achievement;

namespace Infrastructure.Telegram.Services;

public class TelegramNotificationService : IUserNotificationService
{
    private readonly ITelegramBotClient _client;
    private readonly BotConfiguration _config;

    public TelegramNotificationService(ITelegramBotClient client, BotConfiguration config)
    {
        _client = client;
        _config = config;
    }

    public async Task SendDailyReturnPushAsync(DomainUser user, string moduleName, string moduleId, int lessonId, string variant, CancellationToken ct)
    {
        var text = variant == "A"
            ? $"Бомбора по тебе скучает 🐶 Продолжишь {moduleName} сегодня?"
            : $"{moduleName} ждёт продолжения 📖 Вернёшься?";

        // stub: no deep link, no 403 handling, no retry — full impl in green commit
        await _client.SendTextMessageAsync(user.TelegramId, text, cancellationToken: ct);
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