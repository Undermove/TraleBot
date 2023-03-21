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

        services.AddScoped<IAchievementChecker<object>, BasicSmallTalkerChecker>();
        services.AddSingleton<IAchievementUnlocker, AchievementUnlocker>();
        return services;
    }
}