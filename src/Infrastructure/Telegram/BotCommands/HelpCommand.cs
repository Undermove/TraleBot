using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class HelpCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public HelpCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.Help, StringComparison.InvariantCultureIgnoreCase) ||
                               commandPayload.StartsWith(CommandNames.HelpIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
@"❓Если возникли какие-либо проблемы, не стесняйся писать:

💬В чат поддержки https://t.me/TraleBotSupport",
            cancellationToken: token);
    }
}