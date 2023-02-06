using Application.VocabularyEntries;
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
        
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]{ InlineKeyboardButton.WithCallbackData("❌ Удалить из словаря", $"{CommandNames.RemoveEntry} {result.VocabularyEntryId}")},
            new[]
            {
                InlineKeyboardButton.WithUrl("Wooordhunt",$"https://wooordhunt.ru/word/{request.Text}"),
                InlineKeyboardButton.WithUrl("Reverso Context",$"https://context.reverso.net/translation/russian-english/{request.Text}"),
                InlineKeyboardButton.WithUrl("Послушать",$"https://youglish.com/pronounce/{request.Text}/english?")
            }
        });
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            result.Translation,
            replyMarkup:keyboard,
            cancellationToken: token);
    }
}