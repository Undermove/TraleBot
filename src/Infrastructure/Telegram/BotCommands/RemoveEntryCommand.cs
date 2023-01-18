using Infrastructure.Telegram.Models;

namespace Infrastructure.Telegram.BotCommands;

public class RemoveEntryCommand : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Start));
    }

    public Task Execute(TelegramRequest request, CancellationToken token)
    {
        throw new NotImplementedException();
    }
}