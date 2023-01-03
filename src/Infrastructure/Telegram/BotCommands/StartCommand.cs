using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class StartCommand : IBotCommand
{
    private readonly TelegramBotClient _client;

    public StartCommand(TelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken cancellationToken)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Start));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Привет, {request.UserName}! Меня зовут Trale. От английского translate and learn. Остроумно, да? 🙂" +
            $"\r\nЯ помогаю учить английский. Напиши мне незнакомое слово, а я найду его перевод. В конце недели я проведу для тебя квиз из всех присланных тобой слов😎",
            cancellationToken: token);
    }
}