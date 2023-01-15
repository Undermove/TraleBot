using Application.Quizzes;
using Application.Quizzes.Commands;
using Application.Quizzes.Queries;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class CheckQuizAnswerBotCommand: IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public CheckQuizAnswerBotCommand(TelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public async Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var isQuizStarted = await _mediator.Send(
            new CheckIsQuizStartedQuery { UserId = request.UserId },
            ct);
        return isQuizStarted;
    }

    public async Task Execute(TelegramRequest request, CancellationToken ct)
    {
        var isAnswerCorrect = await _mediator.Send(
            new CheckQuizAnswerCommand { UserId = request.UserId, Answer = request.Text },
            ct);

        if (isAnswerCorrect)
        {
            var word = await _mediator.Send(new GetNextQuizQuestionQuery {UserId = request.UserId}, ct);
            if (word == null)
            {
                await _mediator.Send(new CompleteQuizCommand() {UserId = request.UserId}, ct);
                await _client.SendTextMessageAsync(
                    request.UserTelegramId,
                    "Кажется, что квиз закончен",
                    cancellationToken: ct);
                return;
            }
        
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                $"Переведи слово: {word.Word}",
                cancellationToken: ct);
            
            return;
        }

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "😞Прости, но ответ неверный. Попроуй еще раз.",
            cancellationToken: ct);
    }
}