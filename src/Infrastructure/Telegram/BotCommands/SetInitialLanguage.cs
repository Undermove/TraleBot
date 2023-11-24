using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class SetInitialLanguage : IBotCommand
{
    private readonly IMediator _mediator;
    private readonly ITelegramBotClient _client;

    public SetInitialLanguage(IMediator mediator, ITelegramBotClient client)
    {
        _mediator = mediator;
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.SetInitialLanguage));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await _mediator.Send(new Application.Users.Commands.SetInitialLanguage(), token);
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            @$"Привет, {request.UserName}!");
    }
}