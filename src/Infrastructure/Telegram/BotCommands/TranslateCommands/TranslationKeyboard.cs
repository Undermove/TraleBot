using Application.VocabularyEntries.Commands;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public static class TranslationKeyboard
{
    public static Task HandleSuccess(this ITelegramBotClient client,
        TelegramRequest request, 
        CreateVocabularyEntryResult.TranslationSuccess result, 
        CancellationToken token)
    {
        var removeFromVocabularyText = "❌ Не добавлять в словарь.";
        return SendTranslation(
            client,
            request, 
            result.VocabularyEntryId,
            result.Definition,
            result.AdditionalInfo,
            result.Example,
            removeFromVocabularyText,
            token);
    }
    
    public static Task HandleTranslationExists(this ITelegramBotClient client, 
        TelegramRequest request,
        CreateVocabularyEntryResult.TranslationExists result,
        CancellationToken token)
    {
        var removeFromVocabularyText = "❌ Есть в словаре. Удалить?";
        return SendTranslation(
            client,
            request,
            result.VocabularyEntryId,
            result.Definition,
            result.AdditionalInfo,
            result.Example,
            removeFromVocabularyText,
            token);
    }
    
    private static async Task SendTranslation(
        ITelegramBotClient client,
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

        await client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Определение: {definition}" +
            $"\r\nДругие значения: {additionalInfo}" +
            $"\r\nПример употребления: {example}",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}