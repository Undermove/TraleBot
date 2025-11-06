using Application.Users.Queries;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands;

public class MenuCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public MenuCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.Equals(CommandNames.Menu, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = MenuKeyboard.GetMenuKeyboard(request.User!.Settings.CurrentLanguage);
        
        // If request comes from a callback (button click), edit existing message
        if (request.RequestType == UpdateType.CallbackQuery)
        {
            await _client.EditMessageTextAsync(
                request.UserTelegramId,
                request.MessageId,
                $"{CommandNames.MenuIcon} Меню",
                replyMarkup: keyboard,
                cancellationToken: token);
        }
        // If request comes as text message (/menu command), send new message
        else
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                $"{CommandNames.MenuIcon} Меню",
                replyMarkup: keyboard,
                cancellationToken: token);
        }
    }
}