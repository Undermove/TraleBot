using System.Threading;
using System.Threading.Tasks;
using Infrastructure;
using Microsoft.Extensions.Hosting;
using Telegram.Bot;

namespace Trale.HostedServices;

public class CreateWebhook : IHostedService
{
    private readonly BotConfiguration _config;
    private readonly ITelegramBotClient _telegramBotClient;

    public CreateWebhook(BotConfiguration config, ITelegramBotClient telegramBotClient)
    {
        _config = config;
        _telegramBotClient = telegramBotClient;
    }
        
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(_config.HostAddress))
        {
            await _telegramBotClient.SetWebhookAsync($"{_config.HostAddress}/telegram/{_config.WebhookToken}", dropPendingUpdates: false, cancellationToken: cancellationToken);
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        // set first parameter to true in critical situations
        await _telegramBotClient.DeleteWebhookAsync(false, cancellationToken);
    }
}