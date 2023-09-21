using Application.VocabularyEntries.Commands.CreateVocabularyEntryCommand;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public TranslateCommand(ITelegramBotClient client, IMediator mediator)
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

        await result.Match<Task>(
            success => HandleSuccess(request, token, success),
            exists => HandleTranslationExists(request, token, exists),
            _ => HandleEmojiDetected(request, token),
            _ => HandleFailure(request, token),
            _ => HandleSuggestPremium(request, token));
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
    
    private async Task HandleEmojiDetected(TelegramRequest request, CancellationToken token)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Кажется, что ты отправил мне слишком много эмодзи 😅.",
            cancellationToken: token);
    }
    
    private async Task HandleFailure(TelegramRequest request, CancellationToken token)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Прости, пока не могу перевести это слово 😞." +
            "\r\nВозможно в нём есть опечатка." +
            "\r\n" +
            "\r\nЕсли хочешь добавить ручной перевод, то введи его в формате: слово-перевод" +
            "\r\nК примеру: cat-кошка",
            cancellationToken: token);
    }

    private async Task HandleSuggestPremium(TelegramRequest request, CancellationToken token)
    {
        var reply = new InlineKeyboardMarkup(new[]
        {
            InlineKeyboardButton.WithCallbackData("✅ Посмотреть премиум.", $"{CommandNames.OfferTrial}")
        });

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Не получилось сделать перевод при помощи стандартных средств. Можешь попробовать премиум-перевод с использованием OpenAI API. " +
            "Такой перевод дает возможность переводить идиомы с объяснениями и примерами использования.",
            replyMarkup: reply,
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
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData(removeFromVocabularyText,
                    $"{CommandNames.RemoveEntry} {vocabularyEntryId}")
            },
            // new[]
            // {
            //     InlineKeyboardButton.WithCallbackData("Ввести свой перевод", $"{CommandNames.TranslateManually} {result.VocabularyEntryId}")
            // },
            new[]
            {
                InlineKeyboardButton.WithUrl("Перевод Wooordhunt", $"https://wooordhunt.ru/word/{request.Text}"),
                InlineKeyboardButton.WithUrl("Перевод Reverso Context",
                    $"https://context.reverso.net/translation/russian-english/{request.Text}")
            },
            new[]
            {
                InlineKeyboardButton.WithUrl("Послушать на YouGlish",
                    $"https://youglish.com/pronounce/{request.Text}/english?")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.MenuIcon} Меню", CommandNames.Menu)
            }
        });

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Определение: {definition}" +
            $"\r\nДругие значения: {additionalInfo}" +
            $"\r\nПример употребления: {example}",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}