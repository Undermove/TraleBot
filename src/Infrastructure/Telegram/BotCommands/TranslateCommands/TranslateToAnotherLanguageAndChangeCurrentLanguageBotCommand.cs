using Application.VocabularyEntries.Commands;
using Domain.Entities;
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
        var command = ChangeLanguageCallback.BuildFromRawMessage(request.Text);
        var result = await mediator.Send(new TranslateToAnotherLanguageAndChangeCurrentLanguage
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            TargetLanguage = command.TargetLanguage,
            VocabularyEntryId = command.VocabularyEntryId
        }, token);

        await (result switch
        {
            ChangeAndTranslationResult.TranslationExists exists => HandleTranslationExists(request, exists, token),
            ChangeAndTranslationResult.TranslationSuccess success => HandleSuccess(request, success, token),
            ChangeAndTranslationResult.PromptLengthExceeded => HandlePromptLengthExceeded(request, token),
            ChangeAndTranslationResult.PremiumRequired premiumRequired => HandlePremiumRequired(request, premiumRequired, token),
            ChangeAndTranslationResult.TranslationFailure => HandleFailure(request, token),
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
                        new ChangeLanguageCallback
                        {
                            TargetLanguage = premiumRequired.TargetLanguage,
                            VocabularyEntryId = premiumRequired.VocabularyEntryId
                        }.ToStringCallback())
                },
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("Посмотреть Premium", CommandNames.Pay)
                }
            }),
            cancellationToken: token);
    }

    private Task HandleSuccess(TelegramRequest request, ChangeAndTranslationResult.TranslationSuccess result, CancellationToken token)
    {
        var removeFromVocabularyText = "❌ Не добавлять в словарь.";
        return SendTranslation(
            request, 
            result.VocabularyEntryId,
            result.Definition,
            result.AdditionalInfo,
            result.Example,
            removeFromVocabularyText,
            token);
    }
    
    private Task HandleTranslationExists(TelegramRequest request, ChangeAndTranslationResult.TranslationExists result, CancellationToken token)
    {
        var removeFromVocabularyText = "❌ Есть в словаре. Удалить?";
        return SendTranslation(
            request, 
            result.VocabularyEntryId,
            result.Definition,
            result.AdditionalInfo,
            result.Example,
            removeFromVocabularyText,
            token);
    }
    
    private async Task HandlePromptLengthExceeded(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            "📏 Длина строки слишком большая. Попробуй сократить её. Разрешено не более 40 символов.",
            cancellationToken: token);
    }
    
    private async Task HandleFailure(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
@$"🙇‍ Пока не могу перевести это слово. Для текущего языка перевода: {request.User!.Settings.CurrentLanguage.GetLanguageFlag()}
Слова нет в моей базе или в нём есть опечатка.

Если хочешь добавить ручной перевод, то введи его в формате: слово-перевод
К примеру: cat-кошка",
            cancellationToken: token);
    }

    private async Task SendTranslation(
        TelegramRequest request,
        Guid vocabularyEntryId,
        string definition,
        string additionalInfo,
        string example,
        string removeFromVocabularyText, 
        CancellationToken token)
    {
        var replyMarkup = new List<InlineKeyboardButton[]>
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData(removeFromVocabularyText,
                    $"{CommandNames.RemoveEntry} {vocabularyEntryId}")
            }
        };

        if (request.User!.Settings.CurrentLanguage == Language.English)
        {
            replyMarkup.Add(new[]
            {
                InlineKeyboardButton.WithUrl("Перевод Wooordhunt", $"https://wooordhunt.ru/word/{request.Text}"),
                InlineKeyboardButton.WithUrl("Перевод Reverso Context",
                    $"https://context.reverso.net/translation/russian-english/{request.Text}")
            });
        }
        
        replyMarkup.Add(new[]
        {
            InlineKeyboardButton.WithCallbackData($"{CommandNames.ChangeTranslationLanguageIcon} Перевести на другой язык", $"{CommandNames.ChangeTranslationLanguage} {vocabularyEntryId}"),
        });
        
        replyMarkup.Add(new[]
        {
            InlineKeyboardButton.WithCallbackData($"{CommandNames.MenuIcon} Меню", CommandNames.Menu)
        });
        
        var keyboard = new InlineKeyboardMarkup(replyMarkup.ToArray());

        await client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            $"Определение: {definition}" +
            $"\r\nДругие значения: {additionalInfo}" +
            $"\r\nПример употребления: {example}",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}