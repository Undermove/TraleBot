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

        // Mini-app chat menu button is feature-flagged. When disabled in config, we don't
        // touch the existing menu button at all — prod users continue to see whatever
        // they saw before. When enabled, we point the chat menu button to the SPA root,
        // which auto-detects Telegram WebApp initData and shows the app (or the landing page otherwise).
        if (_config.MiniAppEnabled)
        {
            await _telegramBotClient.SetChatMenuButtonAsync(
                menuButton: new MenuButtonWebApp
                {
                    Text = "🐶 Бомбора",
                    WebApp = new WebAppInfo { Url = $"{_config.HostAddress}/" }
                },
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
