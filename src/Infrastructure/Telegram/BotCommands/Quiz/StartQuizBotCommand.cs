using Application.Quizzes.Commands;
using Application.Quizzes.Commands.StartNewQuiz;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class StartQuizBotCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public StartQuizBotCommand(TelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.Quiz) && commandPayload.Split(' ').Length > 1);
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var quizTypeString = request.Text.Split(' ')[1];
        Enum.TryParse<QuizTypes>(quizTypeString, true, out var quizType);
     
        switch (quizType)
        {
            case QuizTypes.LastWeek:
                var result = await _mediator.Send(new StartNewQuizCommand {UserId = request.UserId}, token);

                if (await IsVocabularyEmpty(request, token, result) ||
                    await IsQuizNotStarted(request, token, result))
                {
                    return;
                }
        
                await StartNewQuiz(request, token, result);
                break;
            case QuizTypes.LastDay:
            case QuizTypes.SeveralRandomWords:
            case QuizTypes.MostFailed:
            default:
                await _client.SendTextMessageAsync(
                    request.UserTelegramId,
                    "🔄Этот тип квиза пока в разработке",
                    cancellationToken: token);
                break;
        }
    }

    private async Task StartNewQuiz(TelegramRequest request, CancellationToken token, StartNewQuizResult result)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Начнем квиз! На этой неделе ты выучил {result.LastWeekVocabularyEntriesCount} новых слов. " +
            "\r\nТы вызываешь у меня восторг!" +
            $"\r\n🏁На случай, если захочешь закончить квиз – вот команда {CommandNames.StopQuiz}",
            cancellationToken: token);

        var word = await _mediator.Send(new GetNextQuizQuestionQuery { UserId = request.UserId }, token);

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Переведи слово: {word!.Word}",
            cancellationToken: token);
    }

    private async Task<bool> IsQuizNotStarted(TelegramRequest request, CancellationToken token, StartNewQuizResult result)
    {
        if (result.IsQuizStartSuccessful)
        {
            return false;
        }
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Кажется, что ты уже начал один квиз." +
            $"\r\nЕсли хочешь его закончить, просто пришли {CommandNames.StopQuiz}",
            cancellationToken: token);
        return true;

    }

    private async Task<bool> IsVocabularyEmpty(TelegramRequest request, CancellationToken token, StartNewQuizResult result)
    {
        if (result.LastWeekVocabularyEntriesCount != 0)
        {
            return false;
        }
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "У тебя пока не было новых слов на этой неделе. Напиши в чатик слово cat и попробуй запустить эту команду еще раз.😉",
            cancellationToken: token);
        return true;

    }
}