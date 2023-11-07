using Infrastructure.Telegram.Models;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateToAnotherLanguageCommand : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        throw new NotImplementedException();
    }

    public Task Execute(TelegramRequest request, CancellationToken token)
    {
        throw new NotImplementedException();
    }
}