using Application.Common.Interfaces;
using Application.Users.Queries;
using Infrastructure.Telegram.Models;
using MediatR;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;

namespace Infrastructure.Telegram;

public class TelegramDialogProcessor: IDialogProcessor
{
    private readonly List<IBotCommand> _commands;
    private readonly ILogger _logger;
    private readonly ITelegramBotClient _telegramBotClient;
    private readonly IMediator _mediator;

    public TelegramDialogProcessor(
        IEnumerable<IBotCommand> commands, 
        ILoggerFactory logger, 
        ITelegramBotClient telegramBotClient, 
        IMediator mediator)
    {
        _telegramBotClient = telegramBotClient;
        _mediator = mediator;
        _commands = commands.ToList();
        _logger = logger.CreateLogger(typeof(TelegramDialogProcessor));
    }
    
    public async Task ProcessCommand<T>(T request, CancellationToken token)
    {
        var telegramRequest = await MapToTelegramRequest(request, token);

        _logger.LogDebug("Incoming request {TelegramRequestText}", telegramRequest.Text);
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
        
        await _telegramBotClient.SendTextMessageAsync(
            telegramRequest.UserTelegramId,
            "Прости, кажется у меня что-то сломалось 😞 Попробуй еще раз через несколько минут." +
            "\r\nЕсли приложение не заработало, то напиши" +
            "\r\n🤖Разработчику бота @Undermove1" +
            "\r\n💬Или в чат поддержки https://t.me/TraleBotSupport", 
            cancellationToken: token);
    }

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
        var user = await _mediator.Send(new GetUserByTelegramId {TelegramId = userTelegramId}, ct);
        
        var telegramRequest = new TelegramRequest(casted, user);
        return telegramRequest;
    }
}