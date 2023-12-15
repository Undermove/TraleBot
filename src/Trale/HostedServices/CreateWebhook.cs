using System;
using System.Threading;
using System.Threading.Tasks;
using Infrastructure.Telegram;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Telegram.Bot;

namespace Trale.HostedServices;

public class CreateWebhook : IHostedService
{
    private readonly BotConfiguration _config;
    private readonly ITelegramBotClient _telegramBotClient;
    private readonly ILogger<CreateWebhook> _logger;

    public CreateWebhook(BotConfiguration config, ITelegramBotClient telegramBotClient, ILogger<CreateWebhook> logger)
    {
        _config = config;
        _telegramBotClient = telegramBotClient;
        _logger = logger;
    }
        
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            if (!string.IsNullOrEmpty(_config.HostAddress))
            {
                _logger.LogInformation($"{_config.HostAddress}/telegram/{_config.WebhookToken}");
                var webhookUri = new Uri($"{_config.HostAddress}/telegram/{_config.WebhookToken}");
                await _telegramBotClient.SetWebhookAsync(webhookUri.AbsoluteUri, dropPendingUpdates: false, cancellationToken: cancellationToken);
            }
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error while creating webhook for bot {BotName}", _config.BotName);
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(_config.HostAddress))
        {
            // set first parameter to true in critical situations
            await _telegramBotClient.DeleteWebhookAsync(false, cancellationToken);
        }
    }
}
