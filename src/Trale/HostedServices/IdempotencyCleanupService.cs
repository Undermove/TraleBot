using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

public class IdempotencyCleanupService(
    IServiceProvider serviceProvider,
    ILogger<IdempotencyCleanupService> logger)
    : BackgroundService
{
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(6); // Run cleanup every 6 hours

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Idempotency cleanup service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                var idempotencyService = scope.ServiceProvider.GetRequiredService<IIdempotencyService>();
                
                await idempotencyService.CleanupOldRecordsAsync(stoppingToken);
                
                logger.LogDebug("Idempotency cleanup completed, next run in {Hours} hours", _cleanupInterval.TotalHours);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during idempotency cleanup");
            }

            await Task.Delay(_cleanupInterval, stoppingToken);
        }
        
        logger.LogInformation("Idempotency cleanup service stopped");
    }
}