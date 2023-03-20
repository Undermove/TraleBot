using Domain.Entities;

namespace Application.Achievements;

public class AchievementUnlocker : IAchievementUnlocker
{
    private readonly IList<object> _achievementCheckers = new List<object>();

    public void AddChecker(AchievementChecker<object> checker)
    {
        _achievementCheckers.Add(checker);
    }
    
    public List<Achievement> CheckAchievements<T>(T entity)
    {
        var unlockedAchievements = new List<Achievement>();

        foreach (var achievementChecker in _achievementCheckers)
        {
            if (achievementChecker is AchievementChecker<T> checker && checker.CheckAchievement(entity))
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

    public void AddChecker<T>(AchievementChecker<T> checker)
    {
        _achievementCheckers.Add(checker);
    }
}