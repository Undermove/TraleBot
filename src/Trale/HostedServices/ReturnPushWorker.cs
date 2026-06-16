using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

/// <summary>
/// Fires the D1+ return-push dispatch once a day at 10:00 UTC (14:00 Tbilisi — morning for
/// most Russian-speaking users). Delegates the eligibility query + actual sending to
/// <see cref="IDailyReturnNotificationService"/> (see issue #951).
/// Uses a scoped service because the dispatcher pulls EF DbContext.
/// </summary>
public class ReturnPushWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<ReturnPushWorker> logger) : BackgroundService
{
    /// <summary>Hour-of-day in UTC the worker fires at.</summary>
    public const int RunHourUtc = 10;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("ReturnPushWorker started; daily run hour={RunHourUtc} UTC", RunHourUtc);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(ComputeDelayUntilNextRun(DateTime.UtcNow), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            await RunOnceAsync(stoppingToken);
        }

        logger.LogInformation("ReturnPushWorker stopped");
    }

    /// <summary>
    /// Returns the delay from <paramref name="nowUtc"/> until the next scheduled run.
    /// If <paramref name="nowUtc"/> is strictly before today's 10:00 UTC, returns the delta
    /// to today's slot. Otherwise (including exactly at 10:00) returns the delta to tomorrow's
    /// slot, so the worker doesn't fire twice in the same calendar day.
    /// </summary>
    public static TimeSpan ComputeDelayUntilNextRun(DateTime nowUtc)
    {
        var nextRun = nowUtc.Date.AddHours(RunHourUtc);
        if (nowUtc >= nextRun) nextRun = nextRun.AddDays(1);
        return nextRun - nowUtc;
    }

    /// <summary>
    /// Runs a single dispatch cycle (resolves the scoped dispatcher and calls DispatchAsync).
    /// Exceptions are caught and logged so a transient failure doesn't crash the host.
    /// </summary>
    public async Task RunOnceAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var service = scope.ServiceProvider.GetRequiredService<IDailyReturnNotificationService>();
            await service.DispatchAsync(ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ReturnPushWorker dispatch iteration failed");
        }
    }
}
