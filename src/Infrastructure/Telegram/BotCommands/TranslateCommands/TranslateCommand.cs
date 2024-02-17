using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateCommand(ITelegramBotClient client, IMediator mediator) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await mediator.Send(new TranslateAndCreateVocabularyEntry
        {
            Word = request.Text,
            UserId = request.User?.Id ?? throw new ApplicationException("User not registered"),
        }, token);

        await (result switch
        {
            CreateVocabularyEntryResult.TranslationSuccess success => client.HandleSuccess(request, success.VocabularyEntryId, success.Definition, success.AdditionalInfo, success.Example, token),
            CreateVocabularyEntryResult.TranslationExists exists => client.HandleTranslationExists(request, exists.VocabularyEntryId, exists.Definition, exists.AdditionalInfo, exists.Example, token),
            CreateVocabularyEntryResult.EmojiDetected => client.HandleEmojiDetected(request, token),
            CreateVocabularyEntryResult.PromptLengthExceeded => client.HandlePromptLengthExceeded(request, token),
            CreateVocabularyEntryResult.TranslationFailure => client.HandleFailure(request, token),
            CreateVocabularyEntryResult.PremiumRequired premiumRequired => client.HandlePremiumRequired(request,request.User.Settings.CurrentLanguage, premiumRequired.TargetLanguage, token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }
}