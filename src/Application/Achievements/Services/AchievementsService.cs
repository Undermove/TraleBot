using Application.Achievements.Services.Checkers;
using Application.Common;
using Application.Common.Interfaces;
using Application.Common.Interfaces.Achievements;
using Domain.Entities;

namespace Application.Achievements.Services;

public class AchievementsService : IAchievementsService
{
    private readonly IEnumerable<IAchievementChecker<object>> _achievementCheckers;
    private readonly ITraleDbContext _context;
    private readonly IUserNotificationService _userNotificationService;

    public AchievementsService(
        ITraleDbContext context,
        IEnumerable<IAchievementChecker<object>> achievementCheckers, IUserNotificationService userNotificationService)
    {
        _context = context;
        _achievementCheckers = achievementCheckers;
        _userNotificationService = userNotificationService;
    }

    public async Task AssignAchievements<T>(T trigger, Guid userId, CancellationToken ct) where T : IAchievementTrigger
    {
        var user = await _context.Users.FindAsync(userId);
        await _context.Entry(user).Collection(nameof(user.Achievements)).LoadAsync(ct);
        
        var achievementsThatMightBeOpened = CheckAchievementsThatMightBeOpened(trigger, user);
        var newAchievements = GetOnlyNewAchievements(achievementsThatMightBeOpened, user).ToArray();
        
        await _context.Achievements.AddRangeAsync(newAchievements, ct);
        await _context.SaveChangesAsync(ct);

        await NotifyAboutAchievements(newAchievements, ct);
    }

    private async Task NotifyAboutAchievements(IEnumerable<Achievement> newAchievements, CancellationToken ct)
    {
        // foreach (var newAchievement in newAchievements)
        // {
        //     await _userNotificationService.NotifyAboutUnlockedAchievementAsync(newAchievement, ct);
        // }
    }

    private List<Achievement> CheckAchievementsThatMightBeOpened<T>(T trigger, User user)
    {
        var unlockedAchievements = new List<Achievement>();

        foreach (var achievementChecker in _achievementCheckers)
        {
            if (achievementChecker is IAchievementChecker<T> checker 
                && checker.CheckAchievement(trigger))
            {
                var achievement = new Achievement
                {
                    Id = Guid.NewGuid(),
                    DateAddedUtc = DateTime.UtcNow,
                    AchievementTypeId = checker.AchievementTypeId,
                    Name = checker.Name,
                    Description = checker.Description,
                    Icon = checker.Icon,
                    User = user,
                    UserId = user.Id
                };
                unlockedAchievements.Add(achievement);
            }
        }

        return unlockedAchievements;
    }
    
    public IEnumerable<Achievement> GetOnlyNewAchievements(List<Achievement> unlockedAchievements, User user)
    {
        var unlockedAchievementTypeIds = user.Achievements.Select(achievement => achievement.AchievementTypeId).ToHashSet();
        var newAchievements = unlockedAchievements
            .Where(achievement => !unlockedAchievementTypeIds.Contains(achievement.AchievementTypeId));
        
        foreach (var newAchievement in newAchievements)
        {
            yield return newAchievement;
        }
    }
}