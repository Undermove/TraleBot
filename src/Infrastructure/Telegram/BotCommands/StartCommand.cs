using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Users.Commands.CreateUser;
using Infrastructure.Telegram.BotCommands.Quiz;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class StartCommand(ITelegramBotClient client, IMediator mediator) : IBotCommand
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

        var menuButton = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData($"{CommandNames.MenuIcon} Меню", CommandNames.Menu) }
        });

        if (isNewUser)
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
$@"გამარჯობა, {request.UserName}! 👋

Меня зовут TraleBot — я помогаю учить грузинский язык.

Только что ты узнал своё первое слово:
გამარჯობა — «привет» по-грузински.

Со мной ты можешь:
• Переводить слова и пополнять словарь
• Учиться через мини-апп «🐶 Бомбора»

Напиши мне любое слово или фразу — переведу и добавлю в словарь.",
                replyMarkup: menuButton,
                cancellationToken: token);
        }
        else
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
$@"გამარჯობა снова, {request.UserName}! 👋

Напиши слово — переведу и добавлю в словарь.",
                replyMarkup: menuButton,
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