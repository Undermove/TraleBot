using Application.Common.Interfaces;
using Application.Users.Queries;
using Infrastructure.Telegram.Models;
using MediatR;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;
using User = Domain.Entities.User;

namespace Infrastructure.Telegram;

public class TelegramDialogProcessor(
    IEnumerable<IBotCommand> commands,
    ILoggerFactory logger,
    ITelegramBotClient telegramBotClient,
    IMediator mediator,
    IIdempotencyService idempotencyService)
    : IDialogProcessor
{
    private readonly List<IBotCommand> _commands = commands.ToList();
    private readonly ILogger _logger = logger.CreateLogger(typeof(TelegramDialogProcessor));

    public async Task ProcessCommand<T>(T request, CancellationToken token)
    {
        if (request is not Update update)
        {
            throw new ArgumentException("Can't cast message to Telegram Update");
        }

        var telegramRequest = await MapToTelegramRequest(request, token);

        _logger.LogDebug("Incoming request {TelegramRequestText} with UpdateId: {UpdateId}", telegramRequest.Text, update.Id);
        
        // Try to mark as processing - this will fail if already processed (race condition protection)
        var canProcess = await idempotencyService.TryMarkRequestAsProcessedAsync(
            update.Id,
            telegramRequest.UserTelegramId,
            update.Type.ToString(),
            telegramRequest.Text,
            token);

        if (!canProcess)
        {
            _logger.LogInformation("Skipping duplicate request with UpdateId: {UpdateId}", update.Id);
            return;
        }

        try
        {
            foreach (var command in _commands)
            {
                var typeName = command.GetType();
                _logger.LogDebug("Try command {CommandName}", typeName);

                if (!await command.IsApplicable(telegramRequest, token))
                {
                    continue;
                }
                
                _logger.LogDebug("Applied command {CommandName}", typeName);
                
                await command.Execute(telegramRequest, token);
                
                _logger.LogInformation("Command with text {RequestText} handled by {CommandName} ", telegramRequest.Text, typeName);
                
                return;
            }
            
            _logger.LogDebug("Command {CommandName} have no handlers", telegramRequest.Text);
        }
        catch (Exception e)
        {
            await SendMessageAboutErrorToUser(token, telegramRequest, e);
        }
    }

    private async Task SendMessageAboutErrorToUser(CancellationToken token, TelegramRequest telegramRequest, Exception e)
    {
        _logger.LogError(e, "Exception while processing request from user: {User} with command {Command}",
            telegramRequest.UserTelegramId, telegramRequest.Text);
        
        await telegramBotClient.SendTextMessageAsync(
            telegramRequest.UserTelegramId,
            ErrorText,
            cancellationToken: token);
    }

    public const string ErrorText =
        "Прости, кажется у меня что-то сломалось 😞 Попробуй еще раз через несколько минут." +
        "\r\nЕсли приложение не заработало, то напиши" +
        "\r\n🤖Разработчику бота @Undermove1" +
        "\r\n💬Или в чат поддержки https://t.me/TraleBotSupport";

    private async Task<TelegramRequest> MapToTelegramRequest<T>(T request, CancellationToken ct)
    {
        if (request is not Update casted)
        {
            throw new ArgumentException("Can't cast message to Telegram request");
        }
        
        var userTelegramId = casted.Message?.From?.Id 
                             ?? casted.CallbackQuery?.From.Id 
                             ?? casted.MyChatMember?.From.Id
                             ?? casted.PreCheckoutQuery?.From.Id
                             ?? throw new ArgumentException();
        var result = await mediator.Send(new GetUserByTelegramId {TelegramId = userTelegramId}, ct);
        var user = result switch
        {
            GetUserResult.ExistedUser existedUser => existedUser.User,
            GetUserResult.UserNotExists => null,
            _ => throw new ArgumentOutOfRangeException()
        };
        
        var telegramRequest = new TelegramRequest(casted, user);
        return telegramRequest;
    }
}