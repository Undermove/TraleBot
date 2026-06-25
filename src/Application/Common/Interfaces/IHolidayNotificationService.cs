namespace Application.Common.Interfaces;

/// <summary>
/// Sends celebratory pushes on Georgian holidays. The actual eligibility query +
/// Telegram send lives in #993; <c>HourlyNotificationWorker</c> calls
/// <see cref="DispatchAsync"/> every hour and the implementation decides whether
/// to fire (Tbilisi-morning window + holiday-of-the-day match).
/// </summary>
public interface IHolidayNotificationService
{
    Task DispatchAsync(CancellationToken ct);
}
