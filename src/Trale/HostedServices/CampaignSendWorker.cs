using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Admin;
using Infrastructure.Telegram;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

/// <summary>
/// Sends the campaigns the owner asked to send to everyone picked ("send to everyone" in the admin),
/// batch by batch, so the admin page does not have to stay open. Sends nothing else: a campaign
/// without that request is never touched. When a campaign has no one left waiting, the owner gets
/// a bot message with how it went. After a restart it carries on where it stopped — the request
/// and every recipient's state are in the database.
/// </summary>
public class CampaignSendWorker(
    IServiceScopeFactory scopeFactory,
    BotConfiguration botConfig,
    ILogger<CampaignSendWorker> logger) : BackgroundService
{
    private const long DefaultOwnerTelegramId = 309149393;
    /// <summary>Nothing to send: how often to look for a new request.</summary>
    private static readonly TimeSpan IdleInterval = TimeSpan.FromSeconds(5);
    /// <summary>Between batches of a campaign being sent.</summary>
    private static readonly TimeSpan BusyInterval = TimeSpan.FromSeconds(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("CampaignSendWorker started");

        while (!stoppingToken.IsCancellationRequested)
        {
            var wait = IdleInterval;
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var campaigns = scope.ServiceProvider.GetRequiredService<BroadcastCampaignService>();
                var round = await campaigns.SendRequestedAsync(stoppingToken);

                foreach (var finished in round.Finished)
                    await TellOwnerAsync(scope.ServiceProvider.GetRequiredService<ICampaignMessageSender>(), finished);

                if (round.RetryAfterSeconds > 0) wait = TimeSpan.FromSeconds(round.RetryAfterSeconds);
                else if (round.Sent > 0) wait = BusyInterval;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "CampaignSendWorker iteration failed");
            }

            try { await Task.Delay(wait, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        logger.LogInformation("CampaignSendWorker stopped");
    }

    private Task TellOwnerAsync(ICampaignMessageSender sender, CampaignStatus s)
    {
        var owner = botConfig.OwnerTelegramId != 0 ? botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var text = $"Рассылка «{s.Key}» разослана.\nДошло: {s.Sent} из {s.Total}"
                   + (s.Blocked > 0 ? $"\nЗаблокировали бота: {s.Blocked}" : "")
                   + (s.Rejected > 0 ? $"\nTelegram не принял: {s.Rejected}" : "")
                   + (s.Unknown > 0 ? $"\nБез ответа от Telegram: {s.Unknown}" : "");
        return sender.SendAsync(owner, text, null, null, s.Key, null, CancellationToken.None);
    }
}
