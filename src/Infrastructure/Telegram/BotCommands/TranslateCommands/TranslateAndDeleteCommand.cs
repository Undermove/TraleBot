using Application.VocabularyEntries.Commands.TranslateAndDeleteVocabulary;
using Domain.Entities;
using Infrastructure.Telegram.CallbackSerialization;
using Infrastructure.Telegram.Models;
using MediatR;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateAndDeleteVocabularyCommand(IMediator mediator) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.TranslateAndDeleteVocabulary, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var callback = request.Text.Deserialize<TranslateAndDeleteVocabularyCallback>();
        await mediator.Send(new TranslateAndDeleteVocabulary
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            TargetLanguage = callback.TargetLanguage,
            VocabularyEntryId = callback.VocabularyEntryId
        }, token);
    }
}

public class TranslateAndDeleteVocabularyCallback
{
    public string CommandName => CommandNames.TranslateAndDeleteVocabulary;
    public Guid VocabularyEntryId { get; init; }
    public Language TargetLanguage { get; init; }
}