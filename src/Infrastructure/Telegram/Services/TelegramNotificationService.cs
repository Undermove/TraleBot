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

    public async Task SendDailyReturnPushAsync(DomainUser user, string moduleId, int lessonId, string variant, CancellationToken ct)
    {
        var text = variant == "A"
            ? "Бомбора по тебе скучает 🐶 Продолжишь урок сегодня?"
            : "Твой урок ждёт продолжения 📖 Вернёшься?";

        var deepLinkUrl = $"{_config.NormalizedHost()}/?moduleId={moduleId}&lessonId={lessonId}";
        var keyboard = new InlineKeyboardMarkup(
            InlineKeyboardButton.WithWebApp("▶️ Продолжить", new WebAppInfo { Url = deepLinkUrl }));

        for (var attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                await _client.SendTextMessageAsync(user.TelegramId, text, replyMarkup: keyboard, cancellationToken: ct);
                await Task.Delay(50, ct); // rate limit: ~20 msg/sec safe for bulk
                return;
            }
            catch (ApiRequestException ex) when (ex.ErrorCode == 403)
            {
                user.IsActive = false;
                return;
            }
            catch (ApiRequestException ex) when (ex.ErrorCode == 429)
            {
                var retryAfter = ex.Parameters?.RetryAfter ?? 1;
                await Task.Delay(retryAfter * 1000, ct);
                // loop to retry once
            }
        }
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
