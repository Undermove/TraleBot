using Application.VocabularyEntries;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public TranslateCommand(
        TelegramBotClient client, 
        IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken cancellationToken)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await _mediator.Send(new CreateVocabularyEntryCommand
        {
            Word = request.Text,
            UserId = request.UserId ?? throw new ApplicationException("User not registered"),
        }, token);
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            result,
            cancellationToken: token);
    }
}