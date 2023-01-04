using Application.VocabularyEntries.Queries.GetVocabularyEntriesList;
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
        var result = await _mediator.Send(new GetVocabularyEntriesListQuery {UserId = request.UserId}, token);
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Начнем квиз. На этой неделе ты выучил {result.VocabularyEntries.Count} новых слов. Это потрясающе!",
            cancellationToken: token);
    }
}