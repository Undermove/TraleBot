using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

/// <summary>
/// Periodically evaluates notification triggers (holiday, coins, streak) and
/// dispatches Telegram messages to eligible users. Runs every 3600 seconds.
/// Uses IServiceScopeFactory because NotificationDispatcherService depends on
/// a scoped EF Core DbContext.
/// </summary>
public class NotificationWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<NotificationWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(3600);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("NotificationWorker started, interval={Interval}s", Interval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<NotificationDispatcherService>();
                await service.ExecuteAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "NotificationWorker iteration failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }

        logger.LogInformation("NotificationWorker stopped");
    }
}
