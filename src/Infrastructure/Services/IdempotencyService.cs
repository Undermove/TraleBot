using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class IdempotencyService(ITraleDbContext context, ILogger<IdempotencyService> logger)
    : IIdempotencyService
{
    public async Task<bool> IsRequestProcessedAsync(int updateId, CancellationToken cancellationToken = default)
    {
        try
        {
            var exists = await context.ProcessedUpdates
                .AnyAsync(x => x.UpdateId == updateId, cancellationToken);
            
            if (exists)
            {
                logger.LogInformation("Duplicate request detected for UpdateId: {UpdateId}", updateId);
            }
            
            return exists;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error checking if request is processed for UpdateId: {UpdateId}", updateId);
            return false;
        }
    }

    public async Task<bool> TryMarkRequestAsProcessedAsync(int updateId, long userTelegramId, string requestType, string text, CancellationToken cancellationToken = default)
    {
        using var transaction = await context.BeginTransactionAsync(cancellationToken);
        try
        {
            // Double-check inside transaction
            var exists = await context.ProcessedUpdates
                .AnyAsync(x => x.UpdateId == updateId, cancellationToken);
            
            if (exists)
            {
                logger.LogInformation("Request already processed (race condition avoided) for UpdateId: {UpdateId}", updateId);
                await transaction.RollbackAsync(cancellationToken);
                return false; // Already processed
            }

            var processedUpdate = new ProcessedUpdate
            {
                UpdateId = updateId,
                ProcessedAt = DateTime.UtcNow,
                UserTelegramId = userTelegramId,
                RequestType = requestType,
                Text = text.Length > 1000 ? text[..1000] : text
            };

            context.ProcessedUpdates.Add(processedUpdate);
            await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            
            logger.LogDebug("Marked request as processed for UpdateId: {UpdateId}", updateId);
            return true; // Successfully marked as processed
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Handle unique constraint violation - another thread already processed this
            logger.LogInformation("Request already processed (unique constraint) for UpdateId: {UpdateId}", updateId);
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error marking request as processed for UpdateId: {UpdateId}", updateId);
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }
    }

    public async Task MarkRequestAsProcessedAsync(int updateId, long userTelegramId, string requestType, string text, CancellationToken cancellationToken = default)
    {
        await TryMarkRequestAsProcessedAsync(updateId, userTelegramId, requestType, text, cancellationToken);
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        // PostgreSQL unique constraint violation
        return ex.InnerException?.Message?.Contains("23505") == true ||
               ex.InnerException?.Message?.Contains("duplicate key") == true;
    }

    public async Task CleanupOldRecordsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-7); // Keep records for 7 days
            
            var oldRecords = await context.ProcessedUpdates
                .Where(x => x.ProcessedAt < cutoffDate)
                .ToListAsync(cancellationToken);

            if (oldRecords.Any())
            {
                context.ProcessedUpdates.RemoveRange(oldRecords);
                await context.SaveChangesAsync(cancellationToken);
                
                logger.LogInformation("Cleaned up {Count} old processed update records", oldRecords.Count);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during cleanup of old processed update records");
            // Don't throw - cleanup is not critical
        }
    }
}