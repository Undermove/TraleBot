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
        int availableXp,
        CancellationToken ct)
    {
        var text = BuildDailyReturnPushText(moduleName, variant, availableXp)
                   + "\n\n" + GeorgianDidYouKnow.Pick();
        var keyboard = BuildDailyReturnPushKeyboard(variant, moduleId, lessonId);

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

    // Cheapest treat in the shop (Дзвали / косточка). Mirrors
    // FeedTreatService.TreatPrices[0]; kept local to avoid an Application ref here.
    private const int CheapestTreatXp = 10;

    /// <summary>
    /// Builds the push copy. The module name is only ever placed inside «…» quotes
    /// (a title position that doesn't decline), so it stays grammatical for any
    /// module — plural ("Глаголы"), singular ("Кафе") alike. The "feed"/"earn"
    /// variants lean on the real mechanic: XP earned in lessons buys treats for Bombora.
    /// </summary>
    internal static string BuildDailyReturnPushText(string moduleName, string variant, int availableXp)
    {
        var quoted = $"«{moduleName}»";
        return variant switch
        {
            // You already have enough XP for a treat — nudge to come feed Bombora.
            "feed" when availableXp >= CheapestTreatXp =>
                $"Бомбора заждалась угощения 🐶 У тебя ⭐ {availableXp} XP — хватит на лакомство. Зайдёшь покормить?",
            // Not enough XP yet (or "earn") — invite to do a lesson and earn it.
            "feed" or "earn" =>
                "Бомбора проголодалась 🐶 Пройди урок, заработай XP и угости её косточкой 🦴",
            // Continue a specific module by name.
            "module" =>
                $"Продолжим {quoted}? 📖 Бомбора ждёт",
            // Soft "miss you" nudge (default).
            _ =>
                "Бомбора по тебе скучает 🐶 Заглянешь на пару минут?",
        };
    }

    public async Task SendStreakMilestonePushAsync(Domain.Entities.User user, int milestone, CancellationToken ct)
    {
        var text = BuildStreakMilestoneText(milestone);
        var keyboard = BuildStreakMilestoneKeyboard();

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
                "Streak milestone push for {TelegramId} hit rate limit; retrying after {RetryAfter}s",
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
                "Streak milestone push for {TelegramId} blocked (403); marking user inactive",
                user.TelegramId);
            user.IsActive = false;
            return;
        }

        await Task.Delay(BulkSendDelay, ct);
    }

    /// <summary>
    /// Push copy for the streak milestones. Each milestone gets the Georgian numeral
    /// in script plus a methodist note: 30 spells out the vigesimal breakdown (20+10),
    /// 100 explicitly contrasts the "simple hundred" ასი with the vigesimal tens.
    /// Unknown milestones fall back to a neutral congratulations.
    /// </summary>
    internal static string BuildStreakMilestoneText(int milestone) => milestone switch
    {
        7 => "7 дней без перерыва! По-грузински: შვიდი დღე — семь дней. Так держать!",
        30 => "30 дней без перерыва! По-грузински: ოცდაათი (20+10) დღე — тридцать дней. " +
              "В грузинском десятки — виджезимальные: 20+10 = 30.",
        100 => "100 дней! По-грузински: ასი დღე — сто дней. ასი — одна сотня, простая форма " +
               "(контраст с виджезимальным 30).",
        _ => $"{milestone} дней без перерыва! Так держать 🎉",
    };

    private InlineKeyboardMarkup BuildStreakMilestoneKeyboard()
    {
        var url = _botConfig.NormalizedHost() + "/";
        return new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp("Открыть мини-апп", new WebAppInfo { Url = url })
            }
        });
    }

    public async Task SendCoinsStalePushAsync(Domain.Entities.User user, int availableXp, CancellationToken ct)
    {
        var text = BuildCoinsStalePushText(availableXp);
        var keyboard = BuildCoinsStaleKeyboard();

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
                "Coins-stale push for {TelegramId} hit rate limit; retrying after {RetryAfter}s",
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
                "Coins-stale push for {TelegramId} blocked (403); marking user inactive",
                user.TelegramId);
            user.IsActive = false;
            return;
        }

        await Task.Delay(BulkSendDelay, ct);
    }

    /// <summary>
    /// AC2b copy. Carries the Georgian phrase, Russian-letter transliteration and translation
    /// so users who can't read Mkhedruli still get the joke; the XP hint anchors the nudge in
    /// concrete numbers ("у тебя 80 XP — хватит на угощение").
    /// </summary>
    internal static string BuildCoinsStalePushText(int availableXp) =>
        $"У тебя ⭐ {availableXp} XP — хватит на угощение для Бомборы 🦴\n" +
        "ბომბორა გახარდება! — Бомбора гахардэба! — Бомбора обрадуется!\n" +
        "Заглянешь покормить?";

    private InlineKeyboardMarkup BuildCoinsStaleKeyboard()
    {
        var url = $"{_botConfig.NormalizedHost()}/?screen=feed";
        return new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp("Покормить Бомбору 🦴", new WebAppInfo { Url = url })
            }
        });
    }

    private InlineKeyboardMarkup BuildDailyReturnPushKeyboard(string variant, string moduleId, int lessonId)
    {
        var host = _botConfig.NormalizedHost();
        // Deep-link straight to the relevant screen, not just into the app: the
        // "feed" nudge opens the dashboard (where Bombora is fed), every other
        // variant jumps right into the lesson via ?screen=practice.
        string url, label;
        if (variant == "feed")
        {
            url = $"{host}/?screen=feed";
            label = "Покормить Бомбору 🦴";
        }
        else
        {
            url = $"{host}/?screen=practice&moduleId={moduleId}&lessonId={lessonId}";
            label = "Продолжить урок 📖";
        }
        return new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp(label, new WebAppInfo { Url = url })
            }
        });
    }
}
