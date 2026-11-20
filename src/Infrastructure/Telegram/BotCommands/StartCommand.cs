using Application.MiniApp.Commands;
using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Users.Commands.CreateUser;
using Domain.Entities;
using Infrastructure.Telegram.BotCommands.Quiz;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class StartCommand(
    ITelegramBotClient client,
    IMediator mediator,
    BotConfiguration botConfig,
    RecordReferralLinkService referralRecorder,
    RecordAcquisitionSourceService acquisitionRecorder,
    ILoggerFactory loggerFactory) : IBotCommand
{
    private const string ReferralPrefix = "ref_";

    /// <summary>
    /// <c>t.me/&lt;bot&gt;?start=verbs</c> or <c>…?start=verbs_&lt;tag&gt;</c>: the button under the answer opens
    /// the mini-app on the «Глаголы» section, and the tag travels with it (<c>src=…</c>) so the visit is
    /// recorded for people who already use the app too (see <c>VerbSectionVisit</c>).
    /// </summary>
    public const string VerbsSectionPayload = "verbs";

    public static bool IsVerbsSectionPayload(string? payload) =>
        payload != null
        && (payload.Equals(VerbsSectionPayload, StringComparison.OrdinalIgnoreCase)
            || payload.StartsWith(VerbsSectionPayload + "_", StringComparison.OrdinalIgnoreCase))
        && RecordAcquisitionSourceService.Sanitize(payload) != null;
    private readonly ILogger _logger = loggerFactory.CreateLogger<StartCommand>();

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        // /app is an alias for /start that gets surfaced as its own slash-command
        // entry on the bot's preview screen. Older users who don't notice the
        // bottom menu button get a clearer named entry point.
        return Task.FromResult(
            commandPayload.Contains(CommandNames.Start) ||
            commandPayload.Contains("/app"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        // New = registered by this very /start. Someone who had blocked the bot and came back is
        // reactivated by CreateUser but is not new: the first-step promise is not for them.
        var isNewUser = false;
        var user = request.User;
        if (request.User is not { IsActive: true })
        {
            var userCreatedResultType = await mediator.Send(new CreateUser {TelegramId = request.UserTelegramId}, token);
            user = userCreatedResultType switch
            {
                CreateUserResult.UserCreated created => created.User,
                CreateUserResult.UserExists exists => exists.User,
                _ => throw new ArgumentOutOfRangeException()
            };
            isNewUser = userCreatedResultType is CreateUserResult.UserCreated;
        }

        var commandWithArgs = request.Text.Split(' ');
        var referralRecorded = false;
        string? verbsSectionTag = null;
        if (ContainsArguments(commandWithArgs))
        {
            var arg = commandWithArgs[1];
            if (IsVerbsSectionPayload(arg))
            {
                verbsSectionTag = RecordAcquisitionSourceService.Sanitize(arg);
            }

            if (arg.StartsWith(ReferralPrefix, StringComparison.OrdinalIgnoreCase))
            {
                if (long.TryParse(arg.AsSpan(ReferralPrefix.Length), out var referrerTelegramId))
                {
                    var refResult = await referralRecorder.ExecuteAsync(user!.Id, referrerTelegramId, token);
                    // Promise the 60 days only when they were really given.
                    referralRecorded = refResult == RecordReferralLinkResult.Recorded;
                    _logger.LogInformation(
                        "Referral attempt from /start: user {User} referrer-tg {Referrer} → {Result}",
                        user.Id, referrerTelegramId, refResult);
                }
            }
            else if (Guid.TryParse(arg, out var shareableQuizId))
            {
                var result = await mediator.Send(new CreateQuizFromShareableCommand
                {
                    UserId = request.User?.Id ?? user!.Id,
                    ShareableQuizId = shareableQuizId
                }, token);

                await (result switch
                {
                    CreateQuizFromShareableResult.SharedQuizCreated created => SendFirstQuestion(request, token, created),
                    CreateQuizFromShareableResult.NotEnoughQuestionsForSharedQuiz _ => Task.CompletedTask,
                    _ => throw new ArgumentOutOfRangeException(nameof(result))
                });

                return;
            }
            else
            {
                // Any other payload is an acquisition source tag from a deep-link,
                // e.g. t.me/trale_bot?start=site. First-touch only — the service
                // ignores it if malformed or the user already has a source. Falls
                // through to the normal welcome flow below.
                var srcResult = await acquisitionRecorder.ExecuteAsync(user!.Id, arg, token);
                _logger.LogInformation(
                    "Acquisition source from /start: user {User} tag {Tag} → {Result}",
                    user.Id, arg, srcResult);
            }
        }

        var miniAppUrl = botConfig.MiniAppEnabled && !string.IsNullOrEmpty(botConfig.HostAddress)
            ? $"{botConfig.NormalizedHost()}/{(verbsSectionTag == null ? "" : $"?screen=verbs&src={verbsSectionTag}")}"
            : null;

        // /app is the focused launchpad: a single WebApp button, no chat-menu
        // fallback. /start keeps both buttons for returning users — the chat menu
        // is a useful secondary path for them. A newcomer gets one button only (below).
        var isAppLauncher = request.Text.Contains("/app", StringComparison.OrdinalIgnoreCase);

        var rows = new List<InlineKeyboardButton[]>();
        if (miniAppUrl != null)
        {
            rows.Add(new[]
            {
                InlineKeyboardButton.WithWebApp(
                    "🚀 Открыть приложение",
                    new WebAppInfo { Url = miniAppUrl })
            });
        }
        if (!isAppLauncher)
        {
            rows.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.MenuIcon} Меню в чате", CommandNames.Menu)
            });
        }
        var keyboard = new InlineKeyboardMarkup(rows);

        if (isNewUser)
        {
            // One short message from Bombora with one button: nothing else competes with opening
            // the mini-app. The chat menu and word translation stay available (/menu, any text).
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                FirstStepMessage.WelcomeText(
                    request.UserName, referralRecorded, verbsSectionTag != null, miniApp: miniAppUrl != null),
                replyMarkup: miniAppUrl != null
                    ? FirstStepMessage.Keyboard(miniAppUrl, verbsSectionTag != null)
                    : keyboard,
                cancellationToken: token);
        }
        else
        {
            var isGeorgianMiniApp = miniAppUrl != null && user?.Settings?.CurrentLanguage == Language.Georgian;
            if (isGeorgianMiniApp)
            {
                var georgianRows = new List<InlineKeyboardButton[]>
                {
                    new[]
                    {
                        InlineKeyboardButton.WithWebApp(
                            "🚀 Открыть приложение",
                            new WebAppInfo { Url = miniAppUrl! })
                    }
                };
                if (!isAppLauncher)
                {
                    georgianRows.Add(new[]
                    {
                        InlineKeyboardButton.WithCallbackData($"{CommandNames.MenuIcon} Меню в чате", CommandNames.Menu)
                    });
                }
                var georgianKeyboard = new InlineKeyboardMarkup(georgianRows);

                await client.SendTextMessageAsync(
                    request.UserTelegramId,
$@"გამარჯობა снова, {request.UserName}! 👋

Пока тебя не было — мы открыли мини-апп.
Теперь Бомбора ждёт тебя прямо в Telegram:
алфавит, грамматика, твой словарь, квизы.

Жми «🏔 Бомбора» рядом с полем ввода — или кнопку ниже.

კარგი? — «Хорошо?» по-грузински 😄",
                    replyMarkup: georgianKeyboard,
                    cancellationToken: token);
            }
            else
            {
                await client.SendTextMessageAsync(
                    request.UserTelegramId,
$@"გამარჯობა снова, {request.UserName}! 👋

Напиши слово — переведу и добавлю в словарь. Или открой TraleBot, чтобы продолжить учиться.",
                    replyMarkup: keyboard,
                    cancellationToken: token);
            }
        }
    }

    private async Task SendFirstQuestion(TelegramRequest request, CancellationToken token, CreateQuizFromShareableResult.SharedQuizCreated sharedQuizCreated)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Начнем квиз! В него войдет {sharedQuizCreated.QuestionsCount} вопросов." +
            $"\r\n🏁На случай, если захочешь закончить квиз – вот команда {CommandNames.StopQuiz}",
            cancellationToken: token);

        await client.SendQuizQuestion(request, sharedQuizCreated.FirstQuestion, token);
    }

    private static bool ContainsArguments(string[] args)
    {
        return args.Length > 1;
    }
}