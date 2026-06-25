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

        // Normalize HostAddress via the shared extension so all WebApp URLs
        // get explicit https:// (Telegram requires it for setChatMenuButton).
        var hostAddress = _config.NormalizedHost();

        await _telegramBotClient.SetWebhookAsync($"{hostAddress}/telegram/{_config.WebhookToken}",
            dropPendingUpdates: false,
            cancellationToken: cancellationToken);

        // Chat menu button (next to the text input) opens the TraleBot mini-app directly
        // when the feature is enabled — so users always have one-tap access to the app.
        // Falls back to standard commands menu when mini-app is disabled.
        if (_config.MiniAppEnabled)
        {
            await _telegramBotClient.SetChatMenuButtonAsync(
                menuButton: new MenuButtonWebApp
                {
                    Text = "🚀 TraleBot",
                    WebApp = new WebAppInfo { Url = $"{hostAddress}/" }
                },
                cancellationToken: cancellationToken);
        }
        else
        {
            await _telegramBotClient.SetChatMenuButtonAsync(
                menuButton: new MenuButtonCommands(),
                cancellationToken: cancellationToken);
        }

        // Bot profile metadata — visible in the bot's preview card in Telegram, in
        // search results, and the /-commands menu. Setting these via API so we don't
        // depend on manual BotFather config drifting from the code.
        try
        {
            await _telegramBotClient.SetMyDescriptionAsync(
                description:
                    "Грузинский в приложении внутри Telegram: алфавит, грамматика, " +
                    "словарь, квизы. Гид — щенок Бомбора 🐶.\n\n" +
                    "Тапни 👉 /app 👈 — чтобы начать.\n\n" +
                    "Первые 30 дней — бесплатно.",
                cancellationToken: cancellationToken);

            await _telegramBotClient.SetMyShortDescriptionAsync(
                shortDescription:
                    "Грузинский в Telegram-приложении 🇬🇪 Алфавит, грамматика, словарь, квизы.",
                cancellationToken: cancellationToken);

            // /app appears in the slash-commands list before the user even opens the
            // chat. Older users who don't notice the bottom menu button get a
            // clear, named entry point: tap "/app — Открыть приложение" and the
            // bot replies with the WebApp button on the next message.
            // /start kept as alias with the same launch-oriented description.
            await _telegramBotClient.SetMyCommandsAsync(
                commands: new[]
                {
                    new BotCommand { Command = "app", Description = "🚀 Открыть приложение" },
                    new BotCommand { Command = "start", Description = "🚀 Открыть приложение" },
                    new BotCommand { Command = "menu", Description = "📋 Меню в чате" },
                    new BotCommand { Command = "notifications", Description = "🔔 Уведомления вкл/выкл" },
                    new BotCommand { Command = "help", Description = "💬 Поддержка" }
                },
                cancellationToken: cancellationToken);
        }
        catch
        {
            // Bot profile metadata is best-effort — don't fail startup if Telegram is flaky
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        // Intentionally NOT calling DeleteWebhookAsync here. With multi-replica
        // deployments and rolling updates, the shutdown of one pod would otherwise
        // wipe the webhook URL while the other pod stays running but never re-runs
        // its StartAsync — leaving Telegram with no delivery target and silently
        // queueing updates. The next pod startup re-sets the webhook to the correct
        // URL anyway, so deletion on shutdown serves no purpose in production.
        return Task.CompletedTask;
    }
}
