namespace Application.Achievements;

public interface IAchievementUnlockService
{
    Task HandleNotificationAsync<T>(T notification);
}