using System.Reflection;
using Application.Achievements;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(Assembly.GetExecutingAssembly());
        var achievementUnlocker = new AchievementUnlocker();
        achievementUnlocker.AddChecker(new BasicSmallTalkerChecker());
        
        services.AddSingleton<IAchievementUnlocker>(achievementUnlocker);
        return services;
    }
}