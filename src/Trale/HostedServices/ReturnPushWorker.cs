using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

public class ReturnPushWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<ReturnPushWorker> logger) : BackgroundService
{
    public static TimeSpan ComputeDelay(DateTime now)
    {
        var nextRun = now.Date.AddHours(10);
        if (now >= nextRun) nextRun = nextRun.AddDays(1);
        return nextRun - now;
    }

    protected virtual TimeSpan GetNextRunDelay() => ComputeDelay(DateTime.UtcNow);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("ReturnPushWorker started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(GetNextRunDelay(), stoppingToken);
                await using var scope = scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<IDailyReturnDispatch>();
                await service.DispatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "ReturnPushWorker iteration failed");
            }
        }

        logger.LogInformation("ReturnPushWorker stopped");
    }
}
