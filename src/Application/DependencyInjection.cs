using System.Reflection;
using Application.Abstractions;
using Application.Achievements.Services;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(Assembly.GetExecutingAssembly());

        services.AddScoped<IAchievementChecker<object>, BasicSmallTalkerChecker>();
        services.AddSingleton<IAchievementsService, AchievementsService>();
        return services;
    }
}