using Domain.Entities;

namespace Application.Achievements;

public interface IAchievementUnlocker
{
    List<Achievement> CheckAchievements<T>(T entity);
    public void AddChecker(AchievementChecker<object> checker);
}