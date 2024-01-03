using Application.VocabularyEntries.Commands;
using Domain.Entities;
using Infrastructure.Telegram.CallbackSerialization;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguageBotCommand(ITelegramBotClient client, IMediator mediator)
    : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.TranslateToAnotherLanguage));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var command = request.Text.Deserialize<TranslateToAnotherLanguageCallback>();
        var result = await mediator.Send(new TranslateToAnotherLanguageAndChangeCurrentLanguage
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            TargetLanguage = command.TargetLanguage,
            VocabularyEntryId = command.VocabularyEntryId
        }, token);

        await (result switch
        {
            ChangeAndTranslationResult.TranslationExists exists => client.HandleTranslationExists(request, exists.VocabularyEntryId, exists.Definition, exists.AdditionalInfo, exists.Example, token),
            ChangeAndTranslationResult.TranslationSuccess success => client.HandleSuccess(request, success.VocabularyEntryId, success.Definition, success.AdditionalInfo, success.Example, token),
            ChangeAndTranslationResult.PromptLengthExceeded => client.HandlePromptLengthExceeded(request, token),
            ChangeAndTranslationResult.PremiumRequired premiumRequired => HandlePremiumRequired(request, premiumRequired, token),
            ChangeAndTranslationResult.TranslationFailure => client.HandleFailure(request, token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }

    private async Task HandlePremiumRequired(
        TelegramRequest request,
        ChangeAndTranslationResult.PremiumRequired premiumRequired,
        CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId, 
text: $@"Бесплатный аккаунт позволяет содержать только один словарь. 

При переключении на другой язык, текущий словарь {premiumRequired.CurrentLanguage.GetLanguageFlag()} будет удалён. Чтобы иметь несколько словарей, подключи PRO-подписку.",
            replyMarkup: new InlineKeyboardMarkup(new[]
            {
                new[]
                {
                    InlineKeyboardButton.WithCallbackData(
                        $"Удалить и перевести на {premiumRequired.TargetLanguage.GetLanguageFlag()}",
                        // todo: change to specified callback with delete and translate
                        new TranslateAndDeleteVocabularyCallback
                        {
                            TargetLanguage = premiumRequired.TargetLanguage,
                            VocabularyEntryId = premiumRequired.VocabularyEntryId
                        }.Serialize())
                },
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("Посмотреть Premium", CommandNames.Pay)
                }
            }),
            cancellationToken: token);
    }
}

public class TranslateToAnotherLanguageCallback
{
    public string CommandName => CommandNames.TranslateToAnotherLanguage;
    public required Guid VocabularyEntryId { get; init; }
    public required Language TargetLanguage { get; init; }
}