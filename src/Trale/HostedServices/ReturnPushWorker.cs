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

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // stub — implemented in green commit
        return Task.CompletedTask;
    }
}
