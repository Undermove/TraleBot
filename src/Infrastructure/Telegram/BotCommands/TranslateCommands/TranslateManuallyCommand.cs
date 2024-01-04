using Application.VocabularyEntries.Commands;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateManuallyCommand(ITelegramBotClient client, IMediator mediator) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.TranslateManually));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var split = request.Text.Split(CommandNames.TranslateManually);
        var word = split[0];
        var definition = split[1];
        
        // todo create new handler for manual translation
        var result = await mediator.Send(new CreateManualTranslation
        {
            Word = word,
            Definition = definition,
            UserId = request.User?.Id ?? throw new ApplicationException("User not registered"),
        }, token);

        await (result switch
        {
            ManualTranslationResult.EntrySaved success => client.HandleSuccess(request, success.VocabularyEntryId, success.Definition, success.AdditionalInfo, null, token),
            ManualTranslationResult.EntryAlreadyExists exists => client.HandleTranslationExists(request, exists.VocabularyEntryId, exists.Definition, exists.AdditionalInfo, null, token),
            ManualTranslationResult.EmojiNotAllowed => client.HandleEmojiDetected(request, token),
            ManualTranslationResult.DefinitionIsNotSet => client.HandleDefinitionIsNotSet(request, token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }
}