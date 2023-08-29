using Application.Users.Commands.CreateUser;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class StartCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public StartCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Start));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await _mediator.Send(new CreateUserCommand {TelegramId = request.UserTelegramId}, token);
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Привет, {request.UserName}! " +
            "\r\nМеня зовут Trale и я помогаю расширять твой словарный запас 🙂" +
            "\r\n" +
            "\r\n🇬🇧Напиши мне незнакомое слово, а я найду его перевод и занесу в твой словарь." +
            "\r\n" +
            "\r\n🔄Можешь писать на русском и на английском. Перевожу в обе стороны 🤩" +
            "\r\n" +
            "\r\nСписок моих команд:" +
            "\r\n/quiz - пройти квиз чтобы закрепить слова" +
            "\r\n/vocabulary - посмотреть слова в словаре" +
            "\r\n/menu - открыть меню",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(),
            cancellationToken: token);
    }
}