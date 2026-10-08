using System;
using System.Security.Cryptography;
using System.Text;
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
        if (IsWebhookToken(token))
        {
            _logger.LogInformation("Request type: {RequestType}", request.Type);
            return dialogProcessor.ProcessCommand(request, cancellationToken);
        }
        
        // Never the supplied value itself: a request with an almost-right token would put that token
        // into the log. Its length and a short hash are enough to tell one attempt from another.
        _logger.LogWarning("Webhook call with a wrong token (length {TokenLength}, sha256 prefix {TokenHash})",
            token?.Length ?? 0, HashPrefix(token));
        return Task.CompletedTask;
    }

    private bool IsWebhookToken(string token)
    {
        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(configuration.WebhookToken))
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(token), Encoding.UTF8.GetBytes(configuration.WebhookToken));
    }

    private static string HashPrefix(string token) =>
        string.IsNullOrEmpty(token)
            ? "-"
            : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)), 0, 4).ToLowerInvariant();
}