using Application.VocabularyEntries.Commands;
using Domain.Entities;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguageBotCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public TranslateToAnotherLanguageAndChangeCurrentLanguageBotCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.TranslateToAnotherLanguage));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var command = ChangeLanguageCallback.BuildFromRawMessage(request.Text);
        var result = await _mediator.Send(new TranslateToAnotherLanguageAndChangeCurrentLanguage
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            TargetLanguage = command.TargetLanguage,
            VocabularyEntryId = command.VocabularyEntryId
        }, token);

        await result.Match<Task>(
            success => HandleSuccess(request, token, success),
            exists => HandleTranslationExists(request, token, exists),
            _ => HandleFailure(request, token));
    }
    
    private async Task HandleSuccess(TelegramRequest request, CancellationToken token, TranslationSuccess result)
    {
        var removeFromVocabularyText = "❌ Не добавлять в словарь.";
        await SendTranslation(
            request, 
            result.VocabularyEntryId,
            result.Definition,
            result.AdditionalInfo,
            result.Example,
            removeFromVocabularyText,
            token);
    }
    
    private async Task HandleTranslationExists(TelegramRequest request, CancellationToken token,
        TranslationExists result)
    {
        var removeFromVocabularyText = "❌ Есть в словаре. Удалить?";
        await SendTranslation(
            request, 
            result.VocabularyEntryId,
            result.Definition,
            result.AdditionalInfo,
            result.Example,
            removeFromVocabularyText,
            token);
    }
    
    private async Task HandleFailure(TelegramRequest request, CancellationToken token)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"🙇‍ Пока не могу перевести это слово. Для текущего языка перевода: {request.User!.Settings.CurrentLanguage.GetLanguageFlag()}" +
            "\r\nСлова нет в моей базе или в нём есть опечатка." +
            "\r\n" +
            "\r\nЕсли хочешь добавить ручной перевод, то введи его в формате: слово-перевод" +
            "\r\nК примеру: cat-кошка",
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

        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            $"Определение: {definition}" +
            $"\r\nДругие значения: {additionalInfo}" +
            $"\r\nПример употребления: {example}",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}