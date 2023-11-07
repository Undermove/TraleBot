using Application.VocabularyEntries.Commands.CreateVocabularyEntryCommand;
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
        var result = await _mediator.Send(new TranslateAndCreateVocabularyEntryCommand
        {
            Word = word,
            Definition = definition,
            UserId = request.User?.Id ?? throw new ApplicationException("User not registered"),
        }, token);

        await result.Match(
            success => HandleSuccess(request, token, success),
            exists => HandleTranslationExists(request, token, exists), 
            _ => Task.CompletedTask,
            _ => Task.CompletedTask,
            _ => Task.CompletedTask);
    }

    private async Task HandleSuccess(TelegramRequest request, CancellationToken token, TranslationSuccess result)
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
    
    private async Task HandleTranslationExists(TelegramRequest request, CancellationToken token, TranslationExists result)
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