using Application.Abstractions;
using Application.Common;
using Domain.Entities;

namespace Application.Achievements.Services;

public class AchievementsService : IAchievementsService
{
    private readonly IEnumerable<IAchievementChecker<object>> _achievementCheckers;
    private readonly ITraleDbContext _context;

    public AchievementsService(
        ITraleDbContext context,
        IEnumerable<IAchievementChecker<object>> achievementCheckers)
    {
        _context = context;
        _achievementCheckers = achievementCheckers;
    }

    public async Task AssignAchievements<T>(CancellationToken ct, User user, T entity)
    {
        var newAchievements = CheckAchievements(entity);
        user.ApplyAchievements(newAchievements);
        await _context.SaveChangesAsync(ct);
    }

    private List<Achievement> CheckAchievements<T>(T entity)
    {
        var unlockedAchievements = new List<Achievement>();

        foreach (var achievementChecker in _achievementCheckers)
        {
            if (achievementChecker is IAchievementChecker<T> checker 
                && checker.CheckAchievement(entity))
            {
                var achievement = new Achievement
                {
                    Id = Guid.NewGuid(),
                    AchievementTypeId = checker.AchievementTypeId,
                    Name = checker.Name,
                    Description = checker.Description,
                    Icon = checker.Icon,
                };
                unlockedAchievements.Add(achievement);
            }
        }

        return unlockedAchievements;
    }
}