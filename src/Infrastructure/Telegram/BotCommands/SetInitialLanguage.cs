using Application.Users.Commands;
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

        await (result switch
        {
            SetInitialLanguageResult.InitialLanguageSet _ => HandleInitialLanguageSet(request),
            SetInitialLanguageResult.InitialLanguageAlreadySet _ => HandleInitialLanguageAlreadySet(request),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }

    private async Task HandleInitialLanguageSet(TelegramRequest request)
    {
        await _client.SendTextMessageAsync(request.UserTelegramId,"initial language set");
    }

    private async Task HandleInitialLanguageAlreadySet(TelegramRequest request)
    {
        await _client.SendTextMessageAsync(request.UserTelegramId,"Ты уже выбрал основной язык, если хочешь пользоваться мультисловарем, то нужно активировать премиум");
    }
}