using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Users.Commands.CreateUser;
using Domain.Entities;
using Infrastructure.Telegram.BotCommands.Quiz;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types;
using User = Domain.Entities.User;

namespace Infrastructure.Telegram.BotCommands;

public class StartCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public StartCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Start));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        User? user = request.User;
        if (request.User == null)
        {
            var userCreatedResultType = await _mediator.Send(new CreateUser {TelegramId = request.UserTelegramId}, token);
            userCreatedResultType.Match(
                created => user = created.User, 
                exists => user = exists.User);
        }

        var commandWithArgs = request.Text.Split(' ');
        if (IsContainsArguments(commandWithArgs))
        {
            var result = await _mediator.Send(new CreateQuizFromShareableCommand
            {
                UserId = request.User?.Id ?? user!.Id,
                ShareableQuizId = Guid.Parse(commandWithArgs[1])
            }, token);

            await result.Match(
                created => SendFirstQuestion(request, token, created),
                _ => Task.CompletedTask,
                _ => SendAnotherQuizInProcessMessage(request, token));
            
            return;
        }
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
@$"Привет, {request.UserName}!
Меня зовут Trale и я помогаю вести персональный словарь и закреплять выученное 🙂

Работаю с несколькими языками: 
Английски 🇬🇧
Грузинский 🇬🇪

Напиши мне незнакомое слово, а я найду его перевод и занесу в твой словарь по выбранному языку.
Один язык бесплатно, мультиязыковой словарь – по недорогой подписке.

Выбери язык, который хочешь учить, и начнем!
",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(Language.English),
            cancellationToken: token);
    }

    private Task<Message> SendAnotherQuizInProcessMessage(TelegramRequest request, CancellationToken token)
    {
        return _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Прости, кажется, что один квиз уже в процессе. Для начала нужно закончить его.",
            cancellationToken: token);
    }

    private async Task SendFirstQuestion(TelegramRequest request, CancellationToken token, SharedQuizCreated sharedQuizCreated)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Начнем квиз! В него войдет {sharedQuizCreated.QuestionsCount} вопросов." +
            $"\r\n🏁На случай, если захочешь закончить квиз – вот команда {CommandNames.StopQuiz}",
            cancellationToken: token);


        await _client.SendQuizQuestion(request, sharedQuizCreated.FirstQuestion, token);
    }
    
    private bool IsContainsArguments(string[] args)
    {
        return args.Length > 1;
    }
}