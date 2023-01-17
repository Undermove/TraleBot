using Application.Quizzes.Commands;
using Application.Quizzes.Commands.StartNewQuiz;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class QuizCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public QuizCommand(TelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Quiz));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await _mediator.Send(new StartNewQuizCommand {UserId = request.UserId}, token);
        if (result.IsQuizStartSuccessful)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "Кажется, что ты уже начал один квиз." +
                $"\r\nЕсли хочешь его закончить, просто пришли {CommandNames.StopQuiz}",
                cancellationToken: token);    
            return;
        }
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Начнем квиз! На этой неделе ты выучил {result.LastWeekVocabularyEntriesCount} новых слов. " +
            "\r\nТы вызываешь у меня восторг!" +
            $"\r\n🏁На случай, если захочешь закончить квиз – вот команда {CommandNames.StopQuiz}",
            cancellationToken: token);

        var word = await _mediator.Send(new GetNextQuizQuestionQuery {UserId = request.UserId}, token);
        if (word == null)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "🏁Кажется, что квиз закончен!" +
                "\r\n🥳Приятно видеть, как ты стараешься – это вдохновляет!",
                cancellationToken: token);
            return;
        }
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Переведи слово: {word.Word}",
            cancellationToken: token);
    }
}