using Application.Quizzes.Commands;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class StopQuizBotCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public StopQuizBotCommand(TelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.StopQuiz) ||
                               commandPayload.StartsWith(CommandNames.StopQuizIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await _mediator.Send(new StopQuizCommand {UserId = request.User!.Id}, token);
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Хорошо, пока закончим этот квиз. 😌" +
            $"\r\nЗахочешь еще один, просто пришли команду {CommandNames.Quiz}",
            cancellationToken: token);
    }
}