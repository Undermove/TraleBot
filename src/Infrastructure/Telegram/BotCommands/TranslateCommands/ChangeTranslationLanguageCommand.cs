using Domain.Entities;
using Infrastructure.Telegram.CallbackSerialization;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class ChangeTranslationLanguageCommand(ITelegramBotClient client) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.ChangeTranslationLanguage, StringComparison.InvariantCultureIgnoreCase) ||
                               commandPayload.StartsWith(CommandNames.ChangeTranslationLanguageIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var vocabularyEntryId = request.Text.Split(' ')[1];
        
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            [
                InlineKeyboardButton.WithCallbackData("🇬🇧 Английский",
                    new TranslateToAnotherLanguageCallback
                    {
                        TargetLanguage = Language.English,
                        VocabularyEntryId = Guid.Parse((ReadOnlySpan<char>)vocabularyEntryId)
                    }.Serialize())
            ],
            new []
            {
                InlineKeyboardButton.WithCallbackData("🇬🇪 Грузинский", new TranslateToAnotherLanguageCallback
                {
                    TargetLanguage = Language.Georgian,
                    VocabularyEntryId = Guid.Parse((ReadOnlySpan<char>)vocabularyEntryId)
                }.Serialize())
            }
        });
        
        await client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}