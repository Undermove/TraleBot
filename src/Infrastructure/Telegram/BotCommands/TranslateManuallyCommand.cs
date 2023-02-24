using Application.VocabularyEntries.Commands;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateManuallyCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public TranslateManuallyCommand(
        TelegramBotClient client, 
        IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.TranslateManually));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        // todo create new handler for manual translation
        var result = await _mediator.Send(new CreateVocabularyEntryCommand
        {
            Word = request.Text,
            UserId = request.User?.Id ?? throw new ApplicationException("User not registered"),
        }, token);

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Определение: {result.Definition}" + $"\r\nДругие значения: {result.AdditionalInfo}",
            cancellationToken: token);
    }
}