using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

/// <summary>
/// Orchestrates the contextual push dispatchers (holiday / coins / streak — #993 / #994 / #995)
/// once per hour at top-of-hour. Each dispatcher decides on its own whether to send (cooldown,
/// milestone match, time-of-day guard via <see cref="Application.Notifications.TbilisiMorningWindow"/>);
/// the worker only ticks them.
///
/// Independent of <see cref="ReturnPushWorker"/>: that one does daily-return on its own cron,
/// this one is the generic hourly fan-out.
/// </summary>
public class HourlyNotificationWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<HourlyNotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("HourlyNotificationWorker started; tick=top-of-hour UTC");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(ComputeDelayUntilNextHour(DateTime.UtcNow), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        logger.LogInformation("HourlyNotificationWorker stopped");
    }

    /// <summary>
    /// Returns the delay from <paramref name="nowUtc"/> until the next top-of-hour. If
    /// <paramref name="nowUtc"/> is exactly at HH:00:00 we still skip to the next hour
    /// (the worker has just run for this tick).
    /// </summary>
    public static TimeSpan ComputeDelayUntilNextHour(DateTime nowUtc)
    {
        var nextTick = new DateTime(nowUtc.Year, nowUtc.Month, nowUtc.Day, nowUtc.Hour, 0, 0, DateTimeKind.Utc)
            .AddHours(1);
        return nextTick - nowUtc;
    }

    /// <summary>
    /// Runs a single fan-out: resolves each dispatcher inside its own try/catch so one
    /// failure doesn't block the others. The dispatcher's own logic decides whether the
    /// current tick is actually a send-worthy moment.
    /// </summary>
    public async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var sp = scope.ServiceProvider;

        await DispatchSafelyAsync<IHolidayNotificationService>(sp, "Holiday", ct);
        await DispatchSafelyAsync<ICoinsNotificationService>(sp, "Coins", ct);
        await DispatchSafelyAsync<IStreakNotificationService>(sp, "Streak", ct);
    }

    private async Task DispatchSafelyAsync<TService>(IServiceProvider sp, string contextName, CancellationToken ct)
        where TService : class
    {
        try
        {
            var service = sp.GetService<TService>();
            if (service is null)
            {
                logger.LogDebug(
                    "{Context} dispatcher not registered yet — skipping (dependency task pending)",
                    contextName);
                return;
            }

            await InvokeDispatchAsync(service, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "{Context} dispatch iteration failed", contextName);
        }
    }

    private static Task InvokeDispatchAsync<TService>(TService service, CancellationToken ct)
        where TService : class
    {
        // All three contextual dispatchers share the same method signature but no common
        // interface (they're separated by domain on purpose). A typed switch keeps the
        // call site allocation-free and avoids reflection.
        return service switch
        {
            IHolidayNotificationService h => h.DispatchAsync(ct),
            ICoinsNotificationService c => c.DispatchAsync(ct),
            IStreakNotificationService s => s.DispatchAsync(ct),
            _ => throw new InvalidOperationException(
                $"Unsupported dispatcher type {typeof(TService).FullName}"),
        };
    }
}
