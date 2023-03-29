using System.Reflection;
using Application.Achievements.Services;
using Application.Achievements.Services.Checkers;
using Application.Common.Interfaces.Achievements;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(Assembly.GetExecutingAssembly());

        services.AddScoped<IAchievementChecker<object>, BasicSmallTalkerChecker>();
        services.AddScoped<IAchievementChecker<object>, AdvancedSmallTalkerChecker>();
        services.AddScoped<IAchievementChecker<object>, YoungEggheadChecker>();
        services.AddScoped<IAchievementChecker<object>, StartingQuizzerChecker>();
        services.AddScoped<IAchievementChecker<object>, MedalistChecker>(); 
        services.AddScoped<IAchievementChecker<object>, SilverPrizeWinnerChecker>(); 
        services.AddScoped<IAchievementChecker<object>, KingOfScoreChecker>();
        services.AddSingleton<IAchievementsService, AchievementsService>();
        return services;
    }
}