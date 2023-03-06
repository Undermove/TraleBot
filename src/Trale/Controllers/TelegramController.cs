using System.Threading;
using System.Threading.Tasks;
using Application.Common.Interfaces;
using Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;

namespace Trale.Controllers;

[ApiController]
[Route("[controller]")]
public class TelegramController : Controller
{
    private readonly BotConfiguration _configuration;
    private readonly TelegramBotClient _telegramBotClient;
    private readonly ILogger _logger;
    private readonly IDialogProcessor _dialogProcessor;

    public TelegramController(
        BotConfiguration configuration,
        TelegramBotClient telegramBotClient,
        ILoggerFactory logger,
        IDialogProcessor dialogProcessor)
    {
        _configuration = configuration;
        _telegramBotClient = telegramBotClient;
        _dialogProcessor = dialogProcessor;
        _logger = logger.CreateLogger(typeof(TelegramController));
    }

    [HttpPost("{token?}")]
    public async Task Webhook(string token, [FromBody] Update request, CancellationToken cancellationToken)
    {
        if (token != _configuration.WebhookToken)
        {
            _logger.LogWarning("Somebody trying to bruteforce webhook token current value: {Token}", token);
            return;
        }
        
        await _dialogProcessor.ProcessCommand(request, cancellationToken);
    }
}