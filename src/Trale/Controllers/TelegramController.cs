using System.Threading;
using System.Threading.Tasks;
using Application.Common.Interfaces;
using Infrastructure.Telegram;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Telegram.Bot.Types;

namespace Trale.Controllers;

[ApiController]
[Route("[controller]")]
public class TelegramController : Controller
{
    private readonly BotConfiguration _configuration;
    private readonly ILogger _logger;
    private readonly IDialogProcessor _dialogProcessor;

    public TelegramController(
        BotConfiguration configuration,
        ILoggerFactory logger,
        IDialogProcessor dialogProcessor)
    {
        _configuration = configuration;
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