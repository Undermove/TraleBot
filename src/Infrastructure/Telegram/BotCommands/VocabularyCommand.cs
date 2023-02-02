using Application.VocabularyEntries.Commands;
using Application.VocabularyEntries.Queries.GetVocabularyEntriesList;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class VocabularyCommand : IBotCommand
{
    private readonly IMediator _mediator;
    private readonly TelegramBotClient _client;

    public VocabularyCommand(IMediator mediator, TelegramBotClient client)
    {
        _mediator = mediator;
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.Vocabulary, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result =  await _mediator.Send(new GetVocabularyEntriesListQuery() {UserId = request.User!.Id}, token);

        if (!result.VocabularyEntries.Any())
        {
            await _client.SendTextMessageAsync(request.UserTelegramId, "📖Словарь пока пуст", cancellationToken: token);
            return;
        }
        
        await _client.SendTextMessageAsync(request.UserTelegramId, "🗑Словарь:", cancellationToken: token);
        foreach (var batch in result.VocabularyEntries)
        {
            var a = batch.Select(entry => $"{entry.Word} - {entry.Definition}");
            var view = String.Join(Environment.NewLine, a);
            
            await _client.SendTextMessageAsync(request.UserTelegramId, view, cancellationToken: token);    
        }
    }
}