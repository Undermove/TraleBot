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
    private readonly BotConfiguration _botConfig;

    public MenuCommand(ITelegramBotClient client, IMediator mediator, BotConfiguration botConfig)
    {
        _client = client;
        _mediator = mediator;
        _botConfig = botConfig;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.Equals(CommandNames.Menu, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var miniAppUrl = _botConfig.MiniAppEnabled && !string.IsNullOrEmpty(_botConfig.HostAddress)
            ? $"{_botConfig.HostAddress}/"
            : null;
        var isOwner = _botConfig.OwnerTelegramId != 0 && request.UserTelegramId == _botConfig.OwnerTelegramId;
        var keyboard = MenuKeyboard.GetMenuKeyboard(request.User!.Settings.CurrentLanguage, miniAppUrl, isOwner);
        
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