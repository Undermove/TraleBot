using Application.MiniApp.Commands;
using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Users.Commands.CreateUser;
using Domain.Entities;
using Infrastructure.Telegram.BotCommands.Quiz;
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
    ILoggerFactory loggerFactory) : IBotCommand
{
    private const string ReferralPrefix = "ref_";
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
        var isNewUser = request.User is not { IsActive: true };
        var user = request.User;
        if (isNewUser)
        {
            var userCreatedResultType = await mediator.Send(new CreateUser {TelegramId = request.UserTelegramId}, token);
            user = userCreatedResultType switch
            {
                CreateUserResult.UserCreated created => created.User,
                CreateUserResult.UserExists exists => exists.User,
                _ => throw new ArgumentOutOfRangeException()
            };
        }

        var commandWithArgs = request.Text.Split(' ');
        var hasReferralArg = false;
        if (ContainsArguments(commandWithArgs))
        {
            var arg = commandWithArgs[1];
            if (arg.StartsWith(ReferralPrefix, StringComparison.OrdinalIgnoreCase))
            {
                hasReferralArg = true;
                if (long.TryParse(arg.AsSpan(ReferralPrefix.Length), out var referrerTelegramId))
                {
                    var refResult = await referralRecorder.ExecuteAsync(user!.Id, referrerTelegramId, token);
                    _logger.LogInformation(
                        "Referral attempt from /start: user {User} referrer-tg {Referrer} → {Result}",
                        user.Id, referrerTelegramId, refResult);
                }
            }
            else
            {
                var result = await mediator.Send(new CreateQuizFromShareableCommand
                {
                    UserId = request.User?.Id ?? user!.Id,
                    ShareableQuizId = Guid.Parse(arg)
                }, token);

                await (result switch
                {
                    CreateQuizFromShareableResult.SharedQuizCreated created => SendFirstQuestion(request, token, created),
                    CreateQuizFromShareableResult.NotEnoughQuestionsForSharedQuiz _ => Task.CompletedTask,
                    _ => throw new ArgumentOutOfRangeException(nameof(result))
                });

                return;
            }
        }

        var miniAppUrl = botConfig.MiniAppEnabled && !string.IsNullOrEmpty(botConfig.HostAddress)
            ? $"{botConfig.NormalizedHost()}/"
            : null;

        // /app is the focused launchpad: a single WebApp button, no chat-menu
        // fallback. /start keeps both buttons because for first-time and
        // returning users, the chat menu is still a useful secondary path.
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
            var trialLine = hasReferralArg
                ? "Тебе ещё и бонус: 60 дней бесплатно вместо 30 — за то, что пришёл по приглашению. 🎁"
                : "Первые 30 дней — всё бесплатно.";

            // Message 1: short welcome — fits on one screen so users see CTA without scrolling.
            await client.SendTextMessageAsync(
                request.UserTelegramId,
$@"გამარჯობა, {request.UserName}! 👋

Я — TraleBot, приложение для изучения грузинского. Ты уже выучил первое слово: გამარჯობა — «привет».

{trialLine}",
                cancellationToken: token);

            // Message 2: dedicated CTA — single big WebApp button, impossible to miss.
            // Older users get a clear «what to do next» without parsing a long text wall.
            if (miniAppUrl != null)
            {
                await client.SendTextMessageAsync(
                    request.UserTelegramId,
                    "↓ Жми кнопку, чтобы открыть приложение. Там алфавит, грамматика, твой словарь и щенок Бомбора 🐶 — гид по грузинскому.\n\nА в чат можешь писать любое слово — переведу и добавлю в словарь.",
                    replyMarkup: keyboard,
                    cancellationToken: token);
            }
            else
            {
                await client.SendTextMessageAsync(
                    request.UserTelegramId,
                    "Напиши мне любое слово или фразу — переведу и добавлю в твой словарь.",
                    replyMarkup: keyboard,
                    cancellationToken: token);
            }
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