using Application.Admin;
using Infrastructure.Telegram;
using Infrastructure.Telegram.BotCommands;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.Services;

public class TelegramMessageSender(
    ITelegramBotClient bot,
    BotConfiguration config,
    ILoggerFactory loggerFactory) : ITelegramMessageSender, ICampaignMessageSender
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<TelegramMessageSender>();

    public async Task<bool> SendTextAsync(long telegramId, string text, bool includeMiniAppButton, CancellationToken ct)
    {
        try
        {
            InlineKeyboardMarkup? keyboard = null;
            if (includeMiniAppButton
                && config.MiniAppEnabled
                && !string.IsNullOrEmpty(config.HostAddress))
            {
                keyboard = new InlineKeyboardMarkup(new[]
                {
                    InlineKeyboardButton.WithWebApp(
                        "🚀 Открыть TraleBot",
                        new WebAppInfo { Url = $"{config.NormalizedHost()}/" })
                });
            }

            await bot.SendTextMessageAsync(
                telegramId, text, replyMarkup: keyboard, cancellationToken: ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send broadcast to {TelegramId}", telegramId);
            return false;
        }
    }

    public async Task<CampaignSendAttempt> SendAsync(
        long telegramId, string text, string? buttonText, string? buttonQuery, string campaignKey,
        IReadOnlyList<string>? surveyOptions, CancellationToken ct)
    {
        InlineKeyboardMarkup? keyboard = null;
        if (surveyOptions is { Count: > 0 })
        {
            // A survey: each option on its own row, so long captions are not cut on a phone.
            keyboard = new InlineKeyboardMarkup(surveyOptions.Select((option, index) => new[]
            {
                InlineKeyboardButton.WithCallbackData(option, SurveyAnswerCommand.CallbackData(campaignKey, index))
            }));
        }
        else if (buttonText != null)
        {
            if (!config.MiniAppEnabled || string.IsNullOrEmpty(config.HostAddress))
            {
                // A campaign built around a button must not quietly go out without it.
                return new CampaignSendAttempt(CampaignSendOutcome.Rejected, Error: "mini-app host is not configured");
            }
            keyboard = new InlineKeyboardMarkup(new[]
            {
                InlineKeyboardButton.WithWebApp(buttonText, new WebAppInfo { Url = CampaignButtonUrl(buttonQuery, campaignKey) })
            });
        }

        try
        {
            await bot.SendTextMessageAsync(telegramId, text, replyMarkup: keyboard, cancellationToken: ct);
            return new CampaignSendAttempt(CampaignSendOutcome.Sent);
        }
        catch (ApiRequestException ex) when (ex.ErrorCode == 429)
        {
            return new CampaignSendAttempt(CampaignSendOutcome.RateLimited, ex.Parameters?.RetryAfter ?? 1, ex.Message);
        }
        catch (ApiRequestException ex) when (ex.ErrorCode == 403)
        {
            return new CampaignSendAttempt(CampaignSendOutcome.Blocked, Error: ex.Message);
        }
        catch (ApiRequestException ex)
        {
            // Telegram answered with an error — the message was not delivered.
            _logger.LogWarning(ex, "Campaign {Campaign}: Telegram rejected the message for {TelegramId}", campaignKey, telegramId);
            return new CampaignSendAttempt(CampaignSendOutcome.Rejected, Error: $"{ex.ErrorCode}: {ex.Message}");
        }
        catch (Exception ex)
        {
            // No answer (network, timeout): unknown whether it was delivered.
            _logger.LogWarning(ex, "Campaign {Campaign}: no answer from Telegram for {TelegramId}", campaignKey, telegramId);
            return new CampaignSendAttempt(CampaignSendOutcome.Unknown, Error: ex.Message);
        }
    }

    /// <summary>Mini-app URL for a campaign button: the given query plus <c>c=key</c>, by which
    /// the mini-app reports the open.</summary>
    private string CampaignButtonUrl(string? buttonQuery, string campaignKey)
    {
        var query = (buttonQuery ?? "").Trim().TrimStart('?');
        return $"{config.NormalizedHost()}/?{(query.Length > 0 ? query + "&" : "")}c={Uri.EscapeDataString(campaignKey)}";
    }
}
