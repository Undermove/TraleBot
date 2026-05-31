using Application.Common;
using Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Application.Notifications;

public class DailyReturnNotificationService(
    ITraleDbContext db,
    IUserNotificationService notificationService,
    ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<DailyReturnNotificationService>();

    public Task DispatchAsync(CancellationToken ct)
    {
        throw new NotImplementedException();
    }
}
