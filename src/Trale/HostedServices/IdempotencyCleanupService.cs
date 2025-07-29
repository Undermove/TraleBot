using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

public class IdempotencyCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<IdempotencyCleanupService> _logger;
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(6); // Run cleanup every 6 hours

    public IdempotencyCleanupService(
        IServiceProvider serviceProvider,
        ILogger<IdempotencyCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Idempotency cleanup service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var idempotencyService = scope.ServiceProvider.GetRequiredService<IIdempotencyService>();
                
                await idempotencyService.CleanupOldRecordsAsync(stoppingToken);
                
                _logger.LogDebug("Idempotency cleanup completed, next run in {Hours} hours", _cleanupInterval.TotalHours);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during idempotency cleanup");
            }

            await Task.Delay(_cleanupInterval, stoppingToken);
        }
        
        _logger.LogInformation("Idempotency cleanup service stopped");
    }
}