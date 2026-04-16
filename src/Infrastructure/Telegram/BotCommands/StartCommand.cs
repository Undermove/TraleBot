using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Users.Commands.CreateUser;
using Infrastructure.Telegram.BotCommands.Quiz;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class StartCommand(ITelegramBotClient client, IMediator mediator, BotConfiguration botConfig) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Start));
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
        if (ContainsArguments(commandWithArgs))
        {
            var result = await mediator.Send(new CreateQuizFromShareableCommand
            {
                UserId = request.User?.Id ?? user!.Id,
                ShareableQuizId = Guid.Parse(commandWithArgs[1])
            }, token);

            await (result switch
            {
                CreateQuizFromShareableResult.SharedQuizCreated created => SendFirstQuestion(request, token, created),
                CreateQuizFromShareableResult.NotEnoughQuestionsForSharedQuiz _ => Task.CompletedTask,
                _ => throw new ArgumentOutOfRangeException(nameof(result))
            });

            return;
        }

        var miniAppUrl = botConfig.MiniAppEnabled && !string.IsNullOrEmpty(botConfig.HostAddress)
            ? $"{botConfig.NormalizedHost()}/"
            : null;

        // Build keyboard: WebApp button (primary CTA) when mini-app is enabled, plus text menu fallback.
        var rows = new List<InlineKeyboardButton[]>();
        if (miniAppUrl != null)
        {
            rows.Add(new[]
            {
                InlineKeyboardButton.WithWebApp(
                    "🚀 Открыть TraleBot",
                    new WebAppInfo { Url = miniAppUrl })
            });
        }
        rows.Add(new[]
        {
            InlineKeyboardButton.WithCallbackData($"{CommandNames.MenuIcon} Меню в чате", CommandNames.Menu)
        });
        var keyboard = new InlineKeyboardMarkup(rows);

        if (isNewUser)
        {
            var hasMiniApp = miniAppUrl != null;
            var miniAppLine = hasMiniApp
                ? "Жми «🚀 Открыть TraleBot» — попадёшь в приложение, где есть алфавит, грамматика, словарь и квизы. Тебя там встретит щенок Бомбора 🐶 — твой гид и маскот.\n\n"
                : "";

            await client.SendTextMessageAsync(
                request.UserTelegramId,
$@"გამარჯობა, {request.UserName}! 👋

Я — TraleBot, приложение для изучения грузинского языка прямо в Telegram.

Только что ты узнал своё первое слово:
გამარჯობა — «привет» по-грузински.

{miniAppLine}А ещё в чате со мной можно переводить слова — я добавлю их в твой словарь и сделаю по ним квизы. Просто напиши любое слово или фразу.

Первые 30 дней — всё бесплатно.",
                replyMarkup: keyboard,
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