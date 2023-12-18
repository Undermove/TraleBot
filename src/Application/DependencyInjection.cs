using System.Reflection;
using Application.Achievements.Services;
using Application.Achievements.Services.Checkers;
using Application.Common.Interfaces.Achievements;
using Application.Quizzes.Services;
using Domain.Quiz;
using Microsoft.Extensions.DependencyInjection;

namespace Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

        services.AddTransient<IQuizCreator, QuizCreator>();
        services.AddTransient<IQuizVocabularyEntriesAdvisor, QuizVocabularyEntriesAdvisor>();
        
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, BasicSmallTalkerChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, AdvancedSmallTalkerChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, YoungEggheadChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, StartingQuizzerChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, PerfectionistChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, SolverChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, JustAskChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, KnowByMyselfChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, MedalistChecker>(); 
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, SilverPrizeWinnerChecker>(); 
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, KingOfScoreChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, AmethystChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, EmeraldChecker>();
        services.AddScoped<IAchievementChecker<IAchievementTrigger>, MyselfVocabularyChecker>();
        services.AddTransient<IAchievementsService, AchievementsService>();
        return services;
    }
}