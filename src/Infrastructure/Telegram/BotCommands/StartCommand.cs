using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Quizzes.Commands.GetNextQuizQuestion;
using Application.Users.Commands.CreateUser;
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
            var userCreatedResultType = await _mediator.Send(new CreateUserCommand {TelegramId = request.UserTelegramId}, token);
            userCreatedResultType.Match(
                created => user = created.User, 
                exists => user = exists.User);
        }

        var commandWithArgs = request.Text.Split(' ');
        if (IsContainsArguments(commandWithArgs))
        {
            var result = await _mediator.Send(new CreateQuizFromShareableCommand
            {
                UserId = request.User?.Id ?? user.Id,
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
            $"Привет, {request.UserName}! " +
            "\r\nМеня зовут Trale и я помогаю расширять твой словарный запас 🙂" +
            "\r\n" +
            "\r\n🇬🇧Напиши мне незнакомое слово, а я найду его перевод и занесу в твой словарь." +
            "\r\n" +
            "\r\n🔄Можешь писать на русском и на английском. Перевожу в обе стороны 🤩" +
            "\r\n" +
            "\r\nСписок моих команд:" +
            "\r\n/quiz - пройти квиз чтобы закрепить слова" +
            "\r\n/vocabulary - посмотреть слова в словаре" +
            "\r\n/menu - открыть меню",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(),
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
            $"Начнем квиз! В него войдет {sharedQuizCreated.QuestionsCount} выученных слов. " +
            "\r\nТы вызываешь у меня восторг!" +
            $"\r\n🏁На случай, если захочешь закончить квиз – вот команда {CommandNames.StopQuiz}",
            cancellationToken: token);

        var result = await _mediator.Send(new GetNextQuizQuestionQuery { UserId = request.User!.Id }, token);

        await result.Match(
            nextQuestion => _client.SendQuizQuestion(request, nextQuestion.Question, token),
            _ => Task.CompletedTask,
            _ => Task.CompletedTask
        );
    }
    
    private bool IsContainsArguments(string[] args)
    {
        return args.Length > 1;
    }
}