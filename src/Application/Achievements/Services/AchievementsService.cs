using Application.Common;
using Application.Common.Interfaces;
using Application.Common.Interfaces.Achievements;
using Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Application.Achievements.Services;

public class AchievementsService : IAchievementsService
{
    private readonly IEnumerable<IAchievementChecker<IAchievementTrigger>> _achievementCheckers;
    private readonly ITraleDbContext _context;
    private readonly IUserNotificationService _userNotificationService;
    private readonly ILogger<AchievementsService> _logger;

    public AchievementsService(
        ITraleDbContext context,
        IEnumerable<IAchievementChecker<IAchievementTrigger>> achievementCheckers, IUserNotificationService userNotificationService,
        ILogger<AchievementsService>? logger = null)
    {
        _context = context;
        _achievementCheckers = achievementCheckers;
        _userNotificationService = userNotificationService;
        _logger = logger ?? NullLogger<AchievementsService>.Instance;
    }

    public async Task AssignAchievements<T>(T trigger, Guid userId, CancellationToken ct) where T : IAchievementTrigger
    {
        var user = await _context.Users.FindAsync(userId);
        if (user is null)
        {
            return;
        }
        
        await _context.Entry(user).Collection(nameof(user.Achievements)).LoadAsync(ct);
        
        var achievementsThatMightBeOpened = CheckAchievementsThatMightBeOpened(trigger, user);
        var newAchievements = GetOnlyNewAchievements(achievementsThatMightBeOpened, user).ToArray();
        
        await _context.Achievements.AddRangeAsync(newAchievements, ct);
        await _context.SaveChangesAsync(ct);

        await NotifyAboutAchievements(newAchievements, ct);
    }

    private async Task NotifyAboutAchievements(IEnumerable<Achievement> newAchievements, CancellationToken ct)
    {
        foreach (var newAchievement in newAchievements)
        {
            // The achievement is already saved. Telling the user about it is best effort: a Telegram
            // error (the user blocked the bot, the API is down) must not fail the action that earned it —
            // a translation, a quiz answer.
            try
            {
                await _userNotificationService.NotifyAboutUnlockedAchievementAsync(newAchievement, ct);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                _logger.LogWarning(e, "Could not notify about achievement {AchievementTypeId}", newAchievement.AchievementTypeId);
            }
        }
    }

    private List<Achievement> CheckAchievementsThatMightBeOpened<T>(T trigger, User user) where T: notnull
    {
        var unlockedAchievements = new List<Achievement>();

        foreach (var achievementChecker in _achievementCheckers)
        {
            if (achievementChecker is { } checker 
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

    private IEnumerable<Achievement> GetOnlyNewAchievements(List<Achievement> unlockedAchievements, User user)
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