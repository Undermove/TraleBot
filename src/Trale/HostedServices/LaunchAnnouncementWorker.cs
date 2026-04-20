using System;
using System.Threading;
using System.Threading.Tasks;
using Application.MiniApp.Services;
using Infrastructure.Telegram;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

/// <summary>
/// One-shot background worker: on first startup after MiniAppEnabled=true is set,
/// sends the Бомбора launch announcement to all Georgian users who haven't seen it.
/// Idempotent — safe to restart; users already marked won't receive a duplicate.
/// </summary>
public class LaunchAnnouncementWorker(
    IServiceScopeFactory scopeFactory,
    BotConfiguration config,
    ILogger<LaunchAnnouncementWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.MiniAppEnabled)
        {
            logger.LogInformation("LaunchAnnouncementWorker: skipped (MiniAppEnabled=false)");
            return;
        }

        // Brief delay so the webhook registration (CreateWebhook) completes first.
        await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);

        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var service = scope.ServiceProvider.GetRequiredService<SendLaunchAnnouncementService>();
            var result = await service.ExecuteAsync(stoppingToken);

            logger.LogInformation(
                "LaunchAnnouncementWorker finished: total={Total} sent={Sent} failed={Failed}",
                result.Total, result.Sent, result.Failed);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("LaunchAnnouncementWorker cancelled during shutdown");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "LaunchAnnouncementWorker encountered an error");
        }
    }
}
