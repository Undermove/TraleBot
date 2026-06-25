namespace Application.Common.Interfaces;

/// <summary>
/// Sends streak-milestone pushes (3 / 7 / 14 / 30 day streaks). Eligibility query +
/// Telegram send lives in #995; <c>HourlyNotificationWorker</c> calls
/// <see cref="DispatchAsync"/> every hour and the implementation deduplicates per
/// milestone via a <c>streak_{milestone}</c> trigger key.
/// </summary>
public interface IStreakNotificationService
{
    Task DispatchAsync(CancellationToken ct);
}
