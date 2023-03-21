using Domain.Entities;

namespace Application.Achievements;

public interface IAchievementUnlocker
{
    List<Achievement> CheckAchievements<T>(T entity);
}