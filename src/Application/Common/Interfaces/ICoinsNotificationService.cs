namespace Application.Common.Interfaces;

/// <summary>
/// Sends "you have unspent coins → come feed Bombora" pushes. The eligibility query +
/// Telegram send lives in #994; <c>HourlyNotificationWorker</c> calls
/// <see cref="DispatchAsync"/> every hour and the implementation enforces its own
/// 7-day cooldown per user via <see cref="Domain.Entities.NotificationTrigger"/>.
/// </summary>
public interface ICoinsNotificationService
{
    Task DispatchAsync(CancellationToken ct);
}
