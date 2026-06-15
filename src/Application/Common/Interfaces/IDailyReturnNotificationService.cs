namespace Application.Common.Interfaces;

/// <summary>
/// Dispatches the daily return push to all eligible users (started a lesson, did not return).
/// Implementation in #951; the <see cref="Trale.HostedServices.ReturnPushWorker"/> in src/Trale
/// calls this once a day at 10:00 UTC.
/// </summary>
public interface IDailyReturnNotificationService
{
    Task DispatchAsync(CancellationToken ct);
}
