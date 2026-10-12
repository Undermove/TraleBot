namespace Application.Common.Interfaces;

/// <summary>
/// One gentle reminder to someone who started the bot and has not opened the mini-app in about a
/// day. <c>HourlyNotificationWorker</c> calls <see cref="DispatchAsync"/> every hour; the
/// implementation decides who is due and sends at most one reminder per person, ever.
/// </summary>
public interface IFirstOpenReminderService
{
    Task DispatchAsync(CancellationToken ct);
}
