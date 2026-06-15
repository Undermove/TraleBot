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
        // Implemented in the green step of TDD for #952.
        throw new NotImplementedException();
    }

    /// <summary>
    /// Returns the delay from <paramref name="nowUtc"/> until the next scheduled run.
    /// If <paramref name="nowUtc"/> is before today's 10:00 UTC, returns the delta to today's slot.
    /// Otherwise returns the delta to tomorrow's 10:00 UTC.
    /// </summary>
    public static TimeSpan ComputeDelayUntilNextRun(DateTime nowUtc)
    {
        // Implemented in the green step of TDD for #952.
        throw new NotImplementedException();
    }

    /// <summary>
    /// Runs a single dispatch cycle (resolves the scoped dispatcher and calls DispatchAsync).
    /// Public so that tests can verify the worker delegates correctly without running the
    /// long-running scheduling loop.
    /// </summary>
    public async Task RunOnceAsync(CancellationToken ct)
    {
        // Implemented in the green step of TDD for #952.
        await Task.Yield();
        throw new NotImplementedException();
    }
}
