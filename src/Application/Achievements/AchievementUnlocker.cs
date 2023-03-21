using Domain.Entities;

namespace Application.Achievements;

public class AchievementUnlocker : IAchievementUnlocker
{
    private readonly IEnumerable<IAchievementChecker<object>> _achievementCheckers;

    public AchievementUnlocker(IEnumerable<IAchievementChecker<object>> achievementCheckers)
    {
        _achievementCheckers = achievementCheckers;
    }

    public List<Achievement> CheckAchievements<T>(T entity)
    {
        var unlockedAchievements = new List<Achievement>();

        foreach (var achievementChecker in _achievementCheckers)
        {
            if (achievementChecker is IAchievementChecker<T> checker && checker.CheckAchievement(entity))
            {
                unlockedAchievements.Add(new Achievement
                {
                    Id = Guid.NewGuid(),
                    Name = checker.Name,
                    Description = checker.Description,
                    Icon = checker.Icon,
                });
            }
        }

        return unlockedAchievements;
    }
}