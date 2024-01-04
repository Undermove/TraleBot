using Application.VocabularyEntries.Commands.TranslateAndDeleteVocabulary;
using Domain.Entities;
using Infrastructure.Telegram.CallbackSerialization;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateAndDeleteVocabularyCommand(ITelegramBotClient client, IMediator mediator) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.TranslateAndDeleteVocabulary, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var callback = request.Text.Deserialize<TranslateAndDeleteVocabularyCallback>();
        var result = await mediator.Send(new TranslateAndDeleteVocabulary
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            TargetLanguage = callback.TargetLanguage,
            VocabularyEntryId = callback.VocabularyEntryId
        }, token);
        
        await (result switch
        {
            ChangeAndTranslationResult.TranslationSuccess success => client.HandleSuccess(request, success.VocabularyEntryId, success.Definition, success.AdditionalInfo, success.Example, token),
            ChangeAndTranslationResult.PromptLengthExceeded => client.HandlePromptLengthExceeded(request, token),
            ChangeAndTranslationResult.TranslationFailure => client.HandleFailure(request, token),
            ChangeAndTranslationResult.NoActionNeeded => HandleNoActionNeeded(request, token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }
    
    private async Task HandleNoActionNeeded(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            @"🙇‍ У тебя есть премиум, так что ты можешь просто перевести слово без удаления словаря.",
            cancellationToken: token);
    }
}

public class TranslateAndDeleteVocabularyCallback
{
    public string CommandName => CommandNames.TranslateAndDeleteVocabulary;
    public Guid VocabularyEntryId { get; init; }
    public Language TargetLanguage { get; init; }
}