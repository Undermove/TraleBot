using Application.VocabularyEntries.Commands;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateManuallyCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public TranslateManuallyCommand(ITelegramBotClient client, IMediator mediator)
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
        var split = request.Text.Split(CommandNames.TranslateManually);
        var word = split[0];
        var definition = split[1];
        
        // todo create new handler for manual translation
        var result = await _mediator.Send(new CreateManualTranslation
        {
            Word = word,
            Definition = definition,
            UserId = request.User?.Id ?? throw new ApplicationException("User not registered"),
        }, token);

        await (result switch
        {
            ManualTranslationResult.EntrySaved success => HandleSuccess(request, success, token),
            ManualTranslationResult.EntryAlreadyExists exists => HandleTranslationExists(request, exists, token),
            ManualTranslationResult.EmojiNotAllowed => HandleEmojiDetected(request, token),
            ManualTranslationResult.DefinitionIsNotSet => HandleDefinitionIsNotSet(request,  token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }

    private async Task HandleSuccess(TelegramRequest request, ManualTranslationResult.EntrySaved result, CancellationToken token)
    {
        var removeFromVocabularyText = "❌ Не добавлять в словарь.";
        await SendTranslation(
            request,
            result.VocabularyEntryId,
            result.Definition,
            result.AdditionalInfo,
            removeFromVocabularyText,
            token);
    }
    
    private async Task HandleTranslationExists(TelegramRequest request, ManualTranslationResult.EntryAlreadyExists result,
        CancellationToken token)
    {
        var removeFromVocabularyText = "❌ Есть в словаре. Удалить?";
        await SendTranslation(
            request,
            result.VocabularyEntryId,
            result.Definition,
            result.AdditionalInfo,
            removeFromVocabularyText,
            token);
    }
    
    private Task HandleDefinitionIsNotSet(TelegramRequest request, CancellationToken token)
    {
        return _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Возможно отсутствует определение. Введи его в формате: слово - определение",
            cancellationToken: token);
    }
    
    private async Task HandleEmojiDetected(TelegramRequest request, CancellationToken token)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Кажется, что ты отправил мне слишком много эмодзи 😅.",
            cancellationToken: token);
    }

    private async Task SendTranslation(
        TelegramRequest request,
        Guid vocabularyEntryId,
        string definition,
        string additionalInfo,
        string removeFromVocabularyText,
        CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData(removeFromVocabularyText, $"{CommandNames.RemoveEntry} {vocabularyEntryId}")
            }
        });
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Определение: {definition}" + $"\r\nДругие значения: {additionalInfo}",
            replyMarkup: keyboard, 
            cancellationToken: token);
    }
}