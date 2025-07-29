using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class IdempotencyService : IIdempotencyService
{
    private readonly ITraleDbContext _context;
    private readonly ILogger<IdempotencyService> _logger;
    
    public IdempotencyService(ITraleDbContext context, ILogger<IdempotencyService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<bool> IsRequestProcessedAsync(int updateId, CancellationToken cancellationToken = default)
    {
        try
        {
            var exists = await _context.ProcessedUpdates
                .AnyAsync(x => x.UpdateId == updateId, cancellationToken);
            
            if (exists)
            {
                _logger.LogInformation("Duplicate request detected for UpdateId: {UpdateId}", updateId);
            }
            
            return exists;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking if request is processed for UpdateId: {UpdateId}", updateId);
            return false; // On error, allow processing to prevent blocking
        }
    }

    public async Task MarkRequestAsProcessedAsync(int updateId, long userTelegramId, string requestType, string text, CancellationToken cancellationToken = default)
    {
        try
        {
            var processedUpdate = new ProcessedUpdate
            {
                UpdateId = updateId,
                ProcessedAt = DateTime.UtcNow,
                UserTelegramId = userTelegramId,
                RequestType = requestType,
                Text = text.Length > 1000 ? text[..1000] : text
            };

            _context.ProcessedUpdates.Add(processedUpdate);
            await _context.SaveChangesAsync(cancellationToken);
            
            _logger.LogDebug("Marked request as processed for UpdateId: {UpdateId}", updateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking request as processed for UpdateId: {UpdateId}", updateId);
            // Don't throw - this shouldn't break the main flow
        }
    }

    public async Task CleanupOldRecordsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-7); // Keep records for 7 days
            
            var oldRecords = await _context.ProcessedUpdates
                .Where(x => x.ProcessedAt < cutoffDate)
                .ToListAsync(cancellationToken);

            if (oldRecords.Any())
            {
                _context.ProcessedUpdates.RemoveRange(oldRecords);
                await _context.SaveChangesAsync(cancellationToken);
                
                _logger.LogInformation("Cleaned up {Count} old processed update records", oldRecords.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during cleanup of old processed update records");
            // Don't throw - cleanup is not critical
        }
    }
}