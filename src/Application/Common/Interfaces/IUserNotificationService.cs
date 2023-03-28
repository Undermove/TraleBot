using Domain.Entities;

namespace Application.Common.Interfaces;

public interface IUserNotificationService
{
    Task NotifyAboutUnlockedAchievementAsync(Achievement achievement);
}