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
public class TelegramController(
    BotConfiguration configuration,
    ILoggerFactory logger,
    IDialogProcessor dialogProcessor)
    : Controller
{
    private readonly ILogger _logger = logger.CreateLogger(typeof(TelegramController));

    [HttpPost("{token?}")]
    public Task Webhook(string token, [FromBody] Update request, CancellationToken cancellationToken)
    {
        if (token == configuration.WebhookToken)
        {
            return dialogProcessor.ProcessCommand(request, cancellationToken);
        }
        
        _logger.LogWarning("Somebody trying to bruteforce webhook token current value: {Token}", token);
        return Task.CompletedTask;
    }
}