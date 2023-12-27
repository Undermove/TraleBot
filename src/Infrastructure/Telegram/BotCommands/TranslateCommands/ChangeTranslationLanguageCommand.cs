using Domain.Entities;
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
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🇬🇧 Английский",
                    new TranslateToAnotherLanguageCallback
                    {
                        TargetLanguage = Language.English,
                        VocabularyEntryId = Guid.Parse((ReadOnlySpan<char>)vocabularyEntryId)
                    }.ToStringCallback())
            },
            new []
            {
                InlineKeyboardButton.WithCallbackData("🇬🇪 Грузинский", new TranslateToAnotherLanguageCallback
                {
                    TargetLanguage = Language.Georgian,
                    VocabularyEntryId = Guid.Parse((ReadOnlySpan<char>)vocabularyEntryId)
                }.ToStringCallback())
            }
        });
        
        await client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}