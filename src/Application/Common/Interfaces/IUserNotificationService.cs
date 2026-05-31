using Domain.Entities;

namespace Application.Common.Interfaces;

public interface IUserNotificationService
{
    Task NotifyAboutUnlockedAchievementAsync(Achievement achievement, CancellationToken ct);
    Task SendDailyReturnPushAsync(long telegramId, string moduleName, string moduleId, int lessonId, string variant, CancellationToken ct);
}