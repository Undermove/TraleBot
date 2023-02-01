using Application.VocabularyEntries.Commands;
using Application.VocabularyEntries.Queries.GetVocabularyEntriesList;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class StatisticsCommand : IBotCommand
{
    private readonly IMediator _mediator;
    private readonly TelegramBotClient _client;

    public StatisticsCommand(IMediator mediator, TelegramBotClient client)
    {
        _mediator = mediator;
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.Statistics, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result =  await _mediator.Send(new GetVocabularyEntriesListQuery() {UserId = request.User!.Id}, token);
        await _client.SendTextMessageAsync(request.UserTelegramId, "🗑Статистика", cancellationToken: token);
    }
}