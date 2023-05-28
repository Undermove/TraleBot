using Application.VocabularyEntries.Commands;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class RemoveEntryCommand : IBotCommand
{
    private readonly IMediator _mediator;
    private readonly ITelegramBotClient _client;

    public RemoveEntryCommand(IMediator mediator, ITelegramBotClient client)
    {
        _mediator = mediator;
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.RemoveEntry));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var callback = request.Text.Split(' ')[1];
        await _mediator.Send(new RemoveVocabularyEntryCommand() {VocabularyEntryId = Guid.Parse(callback)}, token);
        await _client.EditMessageTextAsync(request.UserTelegramId, request.MessageId, "🗑Удалил из словаря", cancellationToken: token);
    }
}