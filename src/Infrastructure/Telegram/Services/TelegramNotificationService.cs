using Application.Common.Interfaces;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.Services;

public class TelegramNotificationService : IUserNotificationService
{
    /// <summary>Pause between bulk sends. Telegram allows ~30 msg/s globally; 50 ms = 20 msg/s leaves headroom.</summary>
    internal static readonly TimeSpan BulkSendDelay = TimeSpan.FromMilliseconds(50);

    private readonly ITelegramBotClient _client;
    private readonly BotConfiguration _botConfig;
    private readonly ILogger<TelegramNotificationService> _logger;

    public TelegramNotificationService(
        ITelegramBotClient client,
        BotConfiguration botConfig,
        ILogger<TelegramNotificationService>? logger = null)
    {
        _client = client;
        _botConfig = botConfig;
        _logger = logger ?? NullLogger<TelegramNotificationService>.Instance;
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

    public Task SendDailyReturnPushAsync(
        User user,
        string moduleName,
        string moduleId,
        int lessonId,
        string variant,
        CancellationToken ct)
    {
        // Implemented in the green step of TDD for #952.
        throw new NotImplementedException();
    }
}
