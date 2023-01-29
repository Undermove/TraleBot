using Application.Users.Commands.CreateUser;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class MenuCommand : IBotCommand
{
    private readonly TelegramBotClient _client;

    public MenuCommand(TelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.Equals(CommandNames.Menu, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new ReplyKeyboardMarkup(new[]
        {
            new[]
            {
                new KeyboardButton($"{CommandNames.QuizIcon} Квиз"),
                new KeyboardButton($"{CommandNames.StopQuizIcon} Остановить квиз")
            },
            new[]
            {
                new KeyboardButton($"{CommandNames.PayIcon} Премиум"),
                new KeyboardButton($"{CommandNames.HelpIcon} Поддержка"),
                new KeyboardButton($"{CommandNames.CloseMenu} Закрыть меню")
            }
        });
        keyboard.ResizeKeyboard = true;

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Меню",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}