using Application.Users.Commands.CreateUser;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class StopCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public StopCommand(ITelegramBotClient client, IMediator mediator)
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
            $"Привет, {request.UserName}! Меня зовут Trale. От английского translate and learn. Остроумно, да? 🙂" +
            "\r\n🇬🇧Я помогаю учить английский. Напиши мне незнакомое слово, а я найду его перевод и занесу в словарь. " +
            "\r\n🔄Можешь писать на русском и на английском. Перевожу в обе стороны 🤩" +
            "\r\nОтправь мне /quiz, чтобы пройти квиз по словам за последнюю неделю.",
            cancellationToken: token);
    }
}