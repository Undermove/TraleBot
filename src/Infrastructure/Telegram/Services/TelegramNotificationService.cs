using Application.Common.Interfaces;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types;
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

    public async Task SendDailyReturnPushAsync(
        Domain.Entities.User user,
        string moduleName,
        string moduleId,
        int lessonId,
        string variant,
        CancellationToken ct)
    {
        var text = BuildDailyReturnPushText(moduleName, variant);
        var keyboard = BuildDailyReturnPushKeyboard(moduleId, lessonId);

        try
        {
            await _client.SendTextMessageAsync(
                chatId: user.TelegramId,
                text: text,
                replyMarkup: keyboard,
                cancellationToken: ct);
        }
        catch (ApiRequestException ex) when (ex.ErrorCode == 429)
        {
            var retryAfterSeconds = ex.Parameters?.RetryAfter ?? 1;
            _logger.LogInformation(
                "Daily return push for {TelegramId} hit rate limit; retrying after {RetryAfter}s",
                user.TelegramId, retryAfterSeconds);
            await Task.Delay(TimeSpan.FromSeconds(retryAfterSeconds), ct);
            await _client.SendTextMessageAsync(
                chatId: user.TelegramId,
                text: text,
                replyMarkup: keyboard,
                cancellationToken: ct);
        }
        catch (ApiRequestException ex) when (ex.ErrorCode == 403)
        {
            _logger.LogInformation(
                "Daily return push for {TelegramId} blocked (403); marking user inactive",
                user.TelegramId);
            user.IsActive = false;
            return;
        }

        await Task.Delay(BulkSendDelay, ct);
    }

    internal static string BuildDailyReturnPushText(string moduleName, string variant)
        => variant == "B"
            ? $"{moduleName} ждёт продолжения 📖 Вернёшься?"
            : $"Бомбора по тебе скучает 🐶 Продолжишь {moduleName} сегодня?";

    private InlineKeyboardMarkup BuildDailyReturnPushKeyboard(string moduleId, int lessonId)
    {
        var host = _botConfig.NormalizedHost();
        var url = $"{host}/?moduleId={moduleId}&lessonId={lessonId}";
        return new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp("Продолжить урок", new WebAppInfo { Url = url })
            }
        });
    }
}
