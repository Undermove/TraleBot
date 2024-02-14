using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Users.Commands.CreateUser;
using Infrastructure.Telegram.BotCommands.Quiz;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

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
        
        await client.SendTextMessageAsync(
            request.UserTelegramId,
@$"✌️ Привет, {request.UserName}!

Меня зовут TraleBot, и я помогаю учить языки. Со мной удобно вести персональный словарь и без потери нервных клеток закреплять выученные слова 🌏

Работаю с несколькими языками: 
Английский 🇬🇧
Грузинский 🇬🇪

Напиши мне незнакомое слово, я найду его перевод и занесу в твой словарь.

📌 Один язык — основной — бесплатно, мультиязыковой словарь (из двух и более языков) — по справедливой подписке. 

Выбери основной язык, который хочешь учить, и начнем!

P.S. Обрати внимание: если решишь пользоваться TraleBot как переводчиком, основной язык можно менять хоть каждую минуту — это бесплатно! Но тогда словарь сохраняться не будет. Ну что, погнали?
",
            replyMarkup: LanguageKeyboard.GetLanguageKeyboard($"{CommandNames.SetInitialLanguage}"),
            cancellationToken: token);
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