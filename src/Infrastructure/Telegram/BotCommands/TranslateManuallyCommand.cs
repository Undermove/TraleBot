using Application.VocabularyEntries.Commands;
using Application.VocabularyEntries.Commands.CreateVocabularyEntryCommand;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateManuallyCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public TranslateManuallyCommand(
        TelegramBotClient client, 
        IMediator mediator)
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
        var split = request.Text.Split('-');
        var word = split[0];
        var definition = split[1];
        
        // todo create new handler for manual translation
        var result = await _mediator.Send(new CreateVocabularyEntryCommand
        {
            Word = word,
            Definition = definition,
            UserId = request.User?.Id ?? throw new ApplicationException("User not registered"),
        }, token);

        var removeFromVocabularyText = result.TranslationStatus == TranslationStatus.Translated 
            ? "❌ Не добавлять в словарь." 
            : "❌ Есть в словаре. Удалить?";
        
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData(removeFromVocabularyText, $"{CommandNames.RemoveEntry} {result.VocabularyEntryId}")
            }
        });
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Определение: {result.Definition}" + $"\r\nДругие значения: {result.AdditionalInfo}",
            replyMarkup: keyboard, 
            cancellationToken: token);
    }
}