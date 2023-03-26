namespace Application.Common.Interfaces.Achievements;

public interface IAchievementsService
{
    Task AssignAchievements<T>(T trigger, Guid userId, CancellationToken ct);
}