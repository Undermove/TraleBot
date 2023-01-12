using Application.Quizzes;
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

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken cancellationToken)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Quiz));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await _mediator.Send(new StartNewQuizCommand {UserId = request.UserId}, token);
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Начнем квиз. На этой неделе ты выучил {result} новых слов. Это потрясающе!",
            cancellationToken: token);

        var word = await _mediator.Send(new GetNextQuizQuestionQuery() {UserId = request.UserId}, token);
        if (word == null)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                $"Кажется, что квиз закончен",
                cancellationToken: token);
            return;
        }
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Напиши, как на английском будет: {word.Word}",
            cancellationToken: token);
    }
}