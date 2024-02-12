using Application.Users.Commands;
using Infrastructure.Telegram.Models;
using MediatR;
using Microsoft.Extensions.Logging;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands;

public class StopCommand(IMediator mediator, ILogger<StopCommand> logger)
    : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.Stop) && request.RequestType == UpdateType.MyChatMember);
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null)
        {
            logger.LogInformation("Trying to deactivate non existed user  {UserTelegramId} disabled", request.UserTelegramId);    
        }
        await mediator.Send(new DeactivateUser {TelegramId = request.UserTelegramId}, token);
        logger.LogInformation("User {UserTelegramId} disabled", request.UserTelegramId);
    }
}