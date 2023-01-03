using Application.Common.Interfaces;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;

namespace Infrastructure.Telegram;

public class TelegramDialogProcessor: IDialogProcessor
{
    private readonly List<IBotCommand> _commands;
    private readonly ILogger _logger;
    private readonly TelegramBotClient _telegramBotClient;

    public TelegramDialogProcessor(
        IEnumerable<IBotCommand> processorsList, 
        ILoggerFactory logger, 
        TelegramBotClient telegramBotClient)
    {
        _telegramBotClient = telegramBotClient;
        _commands = processorsList.ToList();
        _logger = logger.CreateLogger(typeof(TelegramDialogProcessor));
    }
    
    public async Task ProcessCommand<T>(T request, CancellationToken token)
    {
        var telegramRequest = MapToTelegramRequest(request);

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
            "Прости, кажется у меня что-то сломалось 😞 Попробуй еще раз через несколько минут.", 
            cancellationToken: token);
        _logger.LogInformation(e, "Exception while processing request from user: {User} with command {Command}",
            telegramRequest.UserTelegramId, telegramRequest.Text);
    }

    private TelegramRequest MapToTelegramRequest<T>(T request)
    {
        if (request is not Update casted)
        {
            throw new ArgumentException("Can't cast message to Telegram request");
        }

        var telegramRequest = new TelegramRequest(casted);
        return telegramRequest;
    }
}