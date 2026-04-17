using System;
using System.Threading;
using System.Threading.Tasks;
using Application.MiniApp.Commands;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

/// <summary>
/// Periodically polls pending referrals and activates those whose referee
/// has met an engagement trigger. Runs every 60 seconds.
/// Uses a scoped service because EF DbContext is scoped.
/// </summary>
public class PendingReferralsWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<PendingReferralsWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(60);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("PendingReferralsWorker started, interval={Interval}s", Interval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<ProcessPendingReferralsService>();
                await service.ExecuteAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "PendingReferralsWorker iteration failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }

        logger.LogInformation("PendingReferralsWorker stopped");
    }
}
