using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Services;

public enum UpdateNotificationsSettingsResult
{
    Success,
    UserNotFound
}

public class UpdateNotificationsSettingsService(ITraleDbContext dbContext)
{
    public async Task<UpdateNotificationsSettingsResult> ExecuteAsync(
        Guid userId, bool enabled, CancellationToken ct)
    {
        var user = await dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user == null)
            return UpdateNotificationsSettingsResult.UserNotFound;

        user.NotificationsEnabled = enabled;
        await dbContext.SaveChangesAsync(ct);

        return UpdateNotificationsSettingsResult.Success;
    }
}
