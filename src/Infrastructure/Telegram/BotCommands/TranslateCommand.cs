using Application.VocabularyEntries.Commands;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public TranslateCommand(
        TelegramBotClient client, 
        IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await _mediator.Send(new CreateVocabularyEntryCommand
        {
            Word = request.Text,
            UserId = request.User?.Id ?? throw new ApplicationException("User not registered"),
        }, token);

        if (result.TranslationStatus == TranslationStatus.CantBeTranslated)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "Прости, пока не могу перевести это слово 😞.",
                cancellationToken: token);
            return;
        }

        var removeFromVocabularyText = result.TranslationStatus == TranslationStatus.Translated 
            ? "❌ Не добавлять в словарь." 
            : "❌ Есть в словаре. Удалить?";
        
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData(removeFromVocabularyText, $"{CommandNames.RemoveEntry} {result.VocabularyEntryId}")
            },
            // new[]
            // {
            //     InlineKeyboardButton.WithCallbackData("Ввести свой перевод", $"{CommandNames.TranslateManually} {request.Text}")
            // },
            new[]
            {
                InlineKeyboardButton.WithUrl("Перевод Wooordhunt",$"https://wooordhunt.ru/word/{request.Text}"),
                InlineKeyboardButton.WithUrl("Перевод Reverso Context",$"https://context.reverso.net/translation/russian-english/{request.Text}")
            },
            new[] 
            {   
                InlineKeyboardButton.WithUrl("Послушать на YouGlish",$"https://youglish.com/pronounce/{request.Text}/english?")
            }
        });
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Определение: {result.Definition}" + $"\r\nДругие значения: {result.AdditionalInfo}",
            replyMarkup:keyboard,
            cancellationToken: token);
    }
}