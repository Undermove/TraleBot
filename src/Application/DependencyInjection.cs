using System.Reflection;
using Application.Achievements.Services;
using Application.Admin;
using Application.Achievements.Services.Checkers;
using Application.Common.Interfaces.Achievements;
using Application.MiniApp.Commands;
using Application.MiniApp.Queries;
using Application.MiniApp.Services;
using Application.Common.Interfaces;
using Application.Notifications;
using Application.Notifications.Holidays;
using Application.Quizzes.Services;
using Application.Translation;
using Application.Translation.Languages;
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

        // Daily-return push targeting (#940). Bound to the interface the worker resolves.
        services.AddScoped<DailyReturnNotificationService>();
        services.AddScoped<IDailyReturnNotificationService>(
            sp => sp.GetRequiredService<DailyReturnNotificationService>());

        // Streak-milestone push (epic #894, §82, #995). HourlyNotificationWorker resolves the
        // interface; the concrete type is exposed too so tests / future direct callers can grab it.
        services.AddScoped<StreakNotificationService>();
        services.AddScoped<IStreakNotificationService>(
            sp => sp.GetRequiredService<StreakNotificationService>());

        // Coins-stale push (epic #894, §82, #994). Same registration shape as the streak service
        // so HourlyNotificationWorker can fan it out via DispatchSafelyAsync<ICoinsNotificationService>.
        services.AddScoped<CoinsNotificationService>();
        services.AddScoped<ICoinsNotificationService>(
            sp => sp.GetRequiredService<CoinsNotificationService>());

        // Holiday catalog (#894 / #992). Pure stateless lookup — singleton.
        services.AddSingleton<IHolidayCalendarService, HolidayCalendarService>();

        // Holiday push dispatcher (#894 / §82, #993). Reads today's Tbilisi holiday from
        // the calendar service and fans out the celebratory push to opted-in active users
        // with a 24h per-day cooldown.
        services.AddScoped<HolidayNotificationService>();
        services.AddScoped<IHolidayNotificationService>(
            sp => sp.GetRequiredService<HolidayNotificationService>());

        services.AddTransient<ILanguageTranslator, LanguageTranslator>();
        services.AddScoped<ITranslationModule, EnglishTranslationModule>();
        services.AddScoped<ITranslationModule, GeorgianTranslationModule>();
        
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

        // MiniApp services (per ARCHITECTURE.md, no MediatR)
        services.AddScoped<GetActivityDaysQuery>();
        services.AddScoped<GetUserVocabularyQuery>();
        services.AddScoped<FeedTreatService>();

        // Acquisition attribution (per ARCHITECTURE.md, no MediatR)
        services.AddScoped<RecordAcquisitionSourceService>();

        // Referral services (per ARCHITECTURE.md, no MediatR)
        services.AddScoped<RecordReferralLinkService>();
        services.AddScoped<TryActivateReferralService>();
        services.AddScoped<ProcessPendingReferralsService>();
        services.AddScoped<GetReferralInfoQuery>();

        // Admin queries (services per ARCHITECTURE.md, no MediatR)
        services.AddScoped<GetAdminStatsQuery>();
        services.AddScoped<GetUserSignupsTimeseriesQuery>();
        services.AddScoped<GetRecentUsersQuery>();
        services.AddScoped<GetUserDetailQuery>();
        services.AddScoped<GrantProService>();
        services.AddScoped<RevokeProService>();
        services.AddScoped<BroadcastService>();

        return services;
    }
}