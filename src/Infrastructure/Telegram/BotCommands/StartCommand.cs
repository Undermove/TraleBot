using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Users.Commands.CreateUser;
using Infrastructure.Telegram.BotCommands.Quiz;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

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
        var user = request.User;
        if (request.User == null)
        {
            var userCreatedResultType = await _mediator.Send(new CreateUser {TelegramId = request.UserTelegramId}, token);
            userCreatedResultType.Match(
                created => user = created.User, 
                exists => user = exists.User);
        }

        var commandWithArgs = request.Text.Split(' ');
        if (ContainsArguments(commandWithArgs))
        {
            var result = await _mediator.Send(new CreateQuizFromShareableCommand
            {
                UserId = request.User?.Id ?? user!.Id,
                ShareableQuizId = Guid.Parse(commandWithArgs[1])
            }, token);

            await result.Match(
                created => SendFirstQuestion(request, token, created),
                _ => Task.CompletedTask);
            
            return;
        }
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
@$"Привет, {request.UserName}!
Меня зовут Trale и я помогаю вести персональный словарь и закреплять выученное 🙂

Работаю с несколькими языками: 
Английский 🇬🇧
Грузинский 🇬🇪

Напиши мне незнакомое слово, а я найду его перевод и занесу в твой словарь по выбранному языку.

Один язык бесплатно, мультиязыковой словарь – по справедливой подписке.

Выбери язык, который хочешь учить, и начнем!
",
            replyMarkup: LanguageKeyboard.GetLanguageKeyboard($"{CommandNames.ChangeCurrentLanguage}"),
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
    
    private static bool ContainsArguments(string[] args)
    {
        return args.Length > 1;
    }
}