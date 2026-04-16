using System.Threading;
using System.Threading.Tasks;
using Infrastructure.Telegram;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;

namespace Trale.HostedServices;

public class CreateWebhook : IHostedService
{
    private readonly BotConfiguration _config;
    private readonly ITelegramBotClient _telegramBotClient;

    public CreateWebhook(BotConfiguration config, ITelegramBotClient telegramBotClient, ILogger<CreateWebhook> logger)
    {
        _config = config;
        _telegramBotClient = telegramBotClient;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(_config.HostAddress))
        {
            return;
        }

        await _telegramBotClient.SetWebhookAsync($"{_config.HostAddress}/telegram/{_config.WebhookToken}",
            dropPendingUpdates: false,
            cancellationToken: cancellationToken);

        // Chat menu button (next to the text input) opens the TraleBot mini-app directly
        // when the feature is enabled — so users always have one-tap access to the app.
        // Falls back to standard commands menu when mini-app is disabled.
        if (_config.MiniAppEnabled && !string.IsNullOrEmpty(_config.HostAddress))
        {
            await _telegramBotClient.SetChatMenuButtonAsync(
                menuButton: new MenuButtonWebApp
                {
                    Text = "🚀 TraleBot",
                    WebApp = new WebAppInfo { Url = $"{_config.HostAddress}/" }
                },
                cancellationToken: cancellationToken);
        }
        else
        {
            await _telegramBotClient.SetChatMenuButtonAsync(
                menuButton: new MenuButtonCommands(),
                cancellationToken: cancellationToken);
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
