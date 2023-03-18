using Domain.AchievementTypes;
using Microsoft.Extensions.DependencyInjection;

namespace Application.Achievements;

public class AchievementUnlockService : IAchievementUnlockService
{
    private readonly IServiceProvider _serviceProvider;

    public AchievementUnlockService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task HandleNotificationAsync<T>(T notification)
    {
        var strategy = _serviceProvider.GetService<AchievementTypeBase<T>>();
        strategy.CheckUnlockConditions(notification);
    }
}