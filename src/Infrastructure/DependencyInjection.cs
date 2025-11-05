using Application.Common;
using Application.Common.Exceptions;
using Application.Common.Interfaces;
using Application.Common.Interfaces.TranslationService;
using Infrastructure.Monitoring;
using Infrastructure.Telegram;
using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.BotCommands.PaymentCommands;
using Infrastructure.Telegram.BotCommands.Quiz;
using Infrastructure.Telegram.BotCommands.TranslateCommands;
using Infrastructure.Telegram.Models;
using Infrastructure.Telegram.Services;
using Infrastructure.Services;
using Infrastructure.Translation;
using Infrastructure.Translation.GoogleTranslation;
using Infrastructure.Translation.OpenAiTranslation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Metrics;
using Persistence;
using Telegram.Bot;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ITraleDbContext>(provider => provider.GetService<TraleDbContext>() ?? throw new InvalidOperationException());

        services.Configure<OpenAiConfig>(configuration.GetSection(OpenAiConfig.Name));
        services.Configure<GoogleApiConfig>(configuration.GetSection(GoogleApiConfig.Name));
        services.AddTransient<IGoogleApiTranslator, GoogleApiTranslator>();
        services.AddTransient<IParsingEnglishTranslator, WooordHuntParsingEnglishParsingEnglishTranslator>();
        services.AddTransient<IParsingUniversalTranslator, GlosbeParsingTranslationService>();
        services.AddTransient<IAiTranslationService, OpenAiAzureTranslationService>();
        services.AddHttpClient();

        services.AddSingleton<IPrometheusResolver, PrometheusResolver>();
        services.AddOpenTelemetry()
            .WithMetrics(builder =>
            {
                builder.AddAspNetCoreInstrumentation();
                builder.AddHttpClientInstrumentation();
                builder.AddRuntimeInstrumentation();
                //builder.AddProcessInstrumentation();
                builder.AddPrometheusExporter();
                builder.AddMeter("Microsoft.AspNetCore.Hosting", "Microsoft.AspNetCore.Server.Kestrel");
            });
        
        var botConfig = configuration.GetSection(BotConfiguration.Configuration).Get<BotConfiguration>();
        if (botConfig == null)
        {
            throw new ConfigurationException(nameof(BotConfiguration));
        }
        services.AddSingleton(botConfig);
        services.AddHttpClient("telegram_bot_client")
            .AddTypedClient<ITelegramBotClient>((httpClient, _) =>
            {
                TelegramBotClientOptions options = new(botConfig.Token.Trim());
                return new TelegramBotClient(options, httpClient);
            });

        services.AddScoped<IUserNotificationService, TelegramNotificationService>();
        services.AddScoped<IIdempotencyService, IdempotencyService>();
        
        // Georgian quiz services
        services.AddScoped<IGeorgianQuizSessionService, GeorgianQuizSessionService>();
        services.AddSingleton<IGeorgianQuestionsLoader, GeorgianQuestionsLoader>();
        
        services.AddScoped<IDialogProcessor, TelegramDialogProcessor>();
        services.AddScoped<IBotCommand, StartCommand>();
        services.AddScoped<IBotCommand, StopCommand>();
        services.AddScoped<IBotCommand, HelpCommand>();
        services.AddScoped<IBotCommand, HowToCommand>();
        services.AddScoped<IBotCommand, MenuCommand>();
        services.AddScoped<IBotCommand, CloseMenuCommand>();
        services.AddScoped<IBotCommand, AcceptCheckoutCommand>();
        services.AddScoped<IBotCommand, PayCommand>();
        services.AddScoped<IBotCommand, RequestInvoiceCommand>();
        services.AddScoped<IBotCommand, OfferTrialCommand>();
        services.AddScoped<IBotCommand, ActivateTrialCommand>();
        services.AddScoped<IBotCommand, VocabularyCommand>();
        services.AddScoped<IBotCommand, AchievementsCommand>();
        services.AddScoped<IBotCommand, QuizCommand>();
        services.AddScoped<IBotCommand, ShowExampleCommand>();
        services.AddScoped<IBotCommand, StartQuizBotCommand>();
        services.AddScoped<IBotCommand, SetInitialLanguage>();
        services.AddScoped<IBotCommand, StopQuizBotCommand>();
        services.AddScoped<IBotCommand, RemoveEntryCommand>();
        services.AddScoped<IBotCommand, CheckQuizAnswerBotCommand>();
        services.AddScoped<IBotCommand, ChangeCurrentLanguageMenuCommand>();
        services.AddScoped<IBotCommand, ChangeCurrentLanguageCommand>();
        services.AddScoped<IBotCommand, ChangeCurrentLanguageAndDeleteVocabularyCommand>();
        services.AddScoped<IBotCommand, ChangeTranslationLanguageCommand>();
        services.AddScoped<IBotCommand, TranslateAndDeleteVocabularyCommand>();
        services.AddScoped<IBotCommand, TranslateToAnotherLanguageAndChangeCurrentLanguageBotCommand>();
        services.AddScoped<IBotCommand, TranslateManuallyCommand>();
        services.AddScoped<IBotCommand, TranslateCommand>();
        services.AddScoped<IBotCommand, GeorgianRepetitionModulesCommand>();
        services.AddScoped<IBotCommand, GeorgianVerbsOfMovementCommand>();
        services.AddScoped<IBotCommand, GeorgianVerbsLessonCommand>();
        services.AddScoped<IBotCommand, GeorgianVerbsQuizCommand>();
        services.AddScoped<IBotCommand, GeorgianVerbsQuizAnswerCommand>();
        return services;
    }
}