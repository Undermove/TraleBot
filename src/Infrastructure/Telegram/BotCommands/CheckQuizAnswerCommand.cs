using Application.Quizzes;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class CheckQuizAnswerCommand: IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public CheckQuizAnswerCommand(TelegramBotClient client, IMediator mediator)
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

    public Task Execute(TelegramRequest request, CancellationToken token)
    {
        throw new NotImplementedException();
    }
}