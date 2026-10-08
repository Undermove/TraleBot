using Application.Feedback;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

/// <summary>
/// A press on an answer button under a survey broadcast. The answer is recorded (one per person per
/// campaign, another button changes it), the press is answered with a short note, and after the
/// first answer the bot says thanks with a button that opens the "Написать автору" screen of the
/// mini-app tied to this survey.
///
/// The bot never waits for a text here: whatever a person types in the chat next is a word to
/// translate, as always. Words of their own are collected only by that mini-app screen.
/// </summary>
public class SurveyAnswerCommand(
    ITelegramBotClient client,
    UserFeedbackService feedback,
    BotConfiguration config,
    ILoggerFactory loggerFactory) : IBotCommand
{
    private const string Prefix = "/survey|";
    private readonly ILogger _logger = loggerFactory.CreateLogger<SurveyAnswerCommand>();

    public const string ThanksText = "Спасибо, записал! Хочешь рассказать подробнее — нажми кнопку ниже.";
    public const string ThanksTextWithoutButton = "Спасибо, записал!";
    public const string TellMoreButton = "Написать подробнее";

    /// <summary>Fits Telegram's 64 bytes: the prefix, a key of at most 48 Latin characters, one digit.</summary>
    public static string CallbackData(string campaignKey, int optionIndex) => $"{Prefix}{campaignKey}|{optionIndex}";

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct) =>
        Task.FromResult(request.RequestType == UpdateType.CallbackQuery
                        && request.Text.StartsWith(Prefix, StringComparison.Ordinal));

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var parts = request.Text[Prefix.Length..].Split('|');
        var answer = request.User != null && parts.Length == 2 && int.TryParse(parts[1], out var index)
            ? await feedback.AnswerSurveyAsync(request.User.Id, parts[0], index, token)
            : SurveyAnswer.Rejected;

        await AnswerPress(request, answer.Outcome switch
        {
            SurveyAnswerOutcome.Recorded => "Спасибо, записал!",
            SurveyAnswerOutcome.Changed => $"Поменял ответ: «{answer.Option}»",
            SurveyAnswerOutcome.Same => "Этот ответ уже записан",
            _ => "Этот опрос уже закрыт"
        }, token);

        // Thanks go once — on the first answer, not on every change of mind.
        if (answer.Outcome != SurveyAnswerOutcome.Recorded) return;

        var canOpenMiniApp = config.MiniAppEnabled && !string.IsNullOrEmpty(config.HostAddress);
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            canOpenMiniApp ? ThanksText : ThanksTextWithoutButton,
            replyMarkup: canOpenMiniApp
                ? new InlineKeyboardMarkup(InlineKeyboardButton.WithWebApp(
                    TellMoreButton, new WebAppInfo { Url = TellMoreUrl(parts[0]) }))
                : null,
            cancellationToken: token);
    }

    /// <summary>The mini-app's "Написать автору" screen; <c>fc</c> ties the message to the survey.</summary>
    private string TellMoreUrl(string campaignKey) =>
        $"{config.NormalizedHost()}/?screen=feedback&fc={Uri.EscapeDataString(campaignKey)}";

    /// <summary>Stops the spinner on the button. A press Telegram no longer accepts an answer for
    /// (too old) must not turn a recorded answer into an error message.</summary>
    private async Task AnswerPress(TelegramRequest request, string text, CancellationToken token)
    {
        if (request.CallbackQueryId == null) return;
        try
        {
            await client.AnswerCallbackQueryAsync(request.CallbackQueryId, text, cancellationToken: token);
        }
        catch (Exception e)
        {
            _logger.LogWarning(e, "Survey: could not answer the button press of {TelegramId}", request.UserTelegramId);
        }
    }
}
