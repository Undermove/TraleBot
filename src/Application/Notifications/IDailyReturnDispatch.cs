namespace Application.Notifications;

public interface IDailyReturnDispatch
{
    Task DispatchAsync(CancellationToken ct);
}
