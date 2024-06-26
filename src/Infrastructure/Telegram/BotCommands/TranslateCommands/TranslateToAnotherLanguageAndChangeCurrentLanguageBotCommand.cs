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
            ChangeAndTranslationResult.TranslationExists exists => client.UpdateExistedTranslation(request, exists.VocabularyEntryId, exists.Definition, exists.AdditionalInfo, exists.Example, token),
            ChangeAndTranslationResult.TranslationSuccess success => client.UpdateTranslation(request, success.VocabularyEntryId, success.Definition, success.AdditionalInfo, success.Example, token),
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
text: $@"Бесплатный аккаунт позволяет вести словарь только на одном языке. 

При переключении на другой язык, текущий словарь {premiumRequired.CurrentLanguage.GetLanguageFlag()} будет удалён. Чтобы иметь несколько словарей на разных языках, подключи ⭐️ Премиум-аккаунт в меню.",
            replyMarkup: new InlineKeyboardMarkup(new[]
            {
                [
                    InlineKeyboardButton.WithCallbackData(
                        $"Удалить и перевести на {premiumRequired.TargetLanguage.GetLanguageFlag()}",
                        new TranslateAndDeleteVocabularyCallback
                        {
                            TargetLanguage = premiumRequired.TargetLanguage,
                            VocabularyEntryId = premiumRequired.VocabularyEntryId
                        }.Serialize())

                ],
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("Подробнее о Премиуме", CommandNames.Pay)
                }
            }),
            cancellationToken: token);
    }
}

public class TranslateToAnotherLanguageCallback
{
    // ReSharper disable once UnusedMember.Global
    public string CommandName => CommandNames.TranslateToAnotherLanguage;
    public required Guid VocabularyEntryId { get; init; }
    public required Language TargetLanguage { get; init; }
}