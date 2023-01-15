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
    private readonly TelegramBotClient _telegramBotClient;
    private readonly IMediator _mediator;

    public TelegramDialogProcessor(
        IEnumerable<IBotCommand> processorsList, 
        ILoggerFactory logger, 
        TelegramBotClient telegramBotClient, IMediator mediator)
    {
        _telegramBotClient = telegramBotClient;
        _mediator = mediator;
        _commands = processorsList.ToList();
        _logger = logger.CreateLogger(typeof(TelegramDialogProcessor));
    }
    
    public async Task ProcessCommand<T>(T request, CancellationToken token)
    {
        var telegramRequest = await MapToTelegramRequest(request, token);

        try
        {
            foreach (var command in _commands)
            {
                if (await command.IsApplicable(telegramRequest, token))
                {
                    await command.Execute(telegramRequest, token);
                    return;
                }
            }
        }
        catch (Exception e)
        {
            await SendMessageAboutErrorToUser(token, telegramRequest, e);
        }
    }

    private async Task SendMessageAboutErrorToUser(CancellationToken token, TelegramRequest telegramRequest, Exception e)
    {
        await _telegramBotClient.SendTextMessageAsync(
            telegramRequest.UserTelegramId,
            "Постой! Прости, кажется у меня что-то сломалось 😞 Попробуй еще раз через несколько минут.", 
            cancellationToken: token);
        _logger.LogError(e, "Exception while processing request from user: {User} with command {Command}",
            telegramRequest.UserTelegramId, telegramRequest.Text);
    }

    private async Task<TelegramRequest> MapToTelegramRequest<T>(T request, CancellationToken ct)
    {
        if (request is not Update casted)
        {
            throw new ArgumentException("Can't cast message to Telegram request");
        }

        var userTelegramId = casted.Message?.From?.Id ?? casted.CallbackQuery?.From.Id ?? throw new ArgumentException();
        var user = await _mediator.Send(new GetUserByTelegramId {TelegramId = userTelegramId}, ct);

        var telegramRequest = new TelegramRequest(casted, user?.Id);
        return telegramRequest;
    }
}