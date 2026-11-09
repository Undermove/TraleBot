namespace Application.Common.Interfaces;

/// <summary>
/// The first week of a newcomer who opened the mini-app: a short message on days 1, 3 and 7 with the
/// next lesson to take. <c>HourlyNotificationWorker</c> calls <see cref="DispatchAsync"/> every hour;
/// the implementation decides who is due and sends each day's message at most once per person.
/// </summary>
public interface IFirstWeekNudgeService
{
    Task DispatchAsync(CancellationToken ct);
}
