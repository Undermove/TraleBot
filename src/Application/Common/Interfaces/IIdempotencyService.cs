namespace Application.Common.Interfaces;

public interface IIdempotencyService
{
    Task<bool> IsRequestProcessedAsync(int updateId, CancellationToken cancellationToken = default);
    Task<bool> TryMarkRequestAsProcessedAsync(int updateId, long userTelegramId, string requestType, string text, CancellationToken cancellationToken = default);
    Task MarkRequestAsProcessedAsync(int updateId, long userTelegramId, string requestType, string text, CancellationToken cancellationToken = default);
    Task CleanupOldRecordsAsync(CancellationToken cancellationToken = default);
}