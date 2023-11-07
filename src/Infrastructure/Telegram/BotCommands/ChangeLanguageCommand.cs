using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class ChangeLanguageCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public ChangeLanguageCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.ChangeLanguage, StringComparison.InvariantCultureIgnoreCase) ||
                               commandPayload.StartsWith(CommandNames.ChangeLanguageIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var translatedWord = request.Text.Split(' ')[1];
        
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🇬🇧 Английский", $"{CommandNames.TranslateToAnotherLanguage}|{Language.English}|{translatedWord}"),
            },
            new []
            {
                InlineKeyboardButton.WithCallbackData("🇬🇪 Грузинский", $"{CommandNames.TranslateToAnotherLanguage}|{Language.Georgian}|{translatedWord}"),
            }
        });
        
        await _client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}