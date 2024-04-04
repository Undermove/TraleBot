using Domain.Entities;
using Infrastructure.Telegram.BotCommands.TranslateCommands;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class ChangeCurrentLanguageMenuCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public ChangeCurrentLanguageMenuCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.ChangeCurrentLanguageMenu, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            [
                InlineKeyboardButton.WithCallbackData("🇬🇧 Английский", $"{CommandNames.ChangeCurrentLanguage} {Language.English}")
            ],
            new []
            {
                InlineKeyboardButton.WithCallbackData("🇬🇪 Грузинский", $"{CommandNames.ChangeCurrentLanguage} {Language.Georgian}")
            }
        });
        
        await _client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}