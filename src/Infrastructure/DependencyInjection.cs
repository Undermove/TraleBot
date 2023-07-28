using Application.Common;
using Application.Common.Exceptions;
using Application.Common.Interfaces;
using Application.Common.Interfaces.TranslationService;
using Infrastructure.Monitoring;
using Infrastructure.Telegram;
using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.BotCommands.PaymentCommands;
using Infrastructure.Telegram.BotCommands.Quiz;
using Infrastructure.Telegram.Models;
using Infrastructure.Telegram.Services;
using Infrastructure.Translation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Telegram.Bot;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ITraleDbContext>(provider => provider.GetService<TraleDbContext>() ?? throw new InvalidOperationException());

        services.Configure<OpenAiConfig>(configuration.GetSection(OpenAiConfig.Name));
        services.AddTransient<ITranslationService, WooordHuntParsingTranslationService>();
        services.AddHttpClient();

        services.AddSingleton<IPrometheusResolver, PrometheusResolver>();
        
        var botConfig = configuration.GetSection(BotConfiguration.Configuration).Get<BotConfiguration>();
        if (botConfig == null)
        {
            throw new ConfigurationException(nameof(BotConfiguration));
        }
        
        services.AddSingleton(botConfig);
        services.AddHttpClient("telegram_bot_client")
            .AddTypedClient<ITelegramBotClient>((httpClient, _) =>
            {
                TelegramBotClientOptions options = new(botConfig.Token);
                return new TelegramBotClient(options, httpClient);
            });

        services.AddScoped<IUserNotificationService, TelegramNotificationService>();
        
        services.AddScoped<IDialogProcessor, TelegramDialogProcessor>();
        services.AddScoped<IBotCommand, StartCommand>();
        services.AddScoped<IBotCommand, HelpCommand>();
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
        services.AddScoped<IBotCommand, StopQuizBotCommand>();
        services.AddScoped<IBotCommand, RemoveEntryCommand>();
        services.AddScoped<IBotCommand, CheckQuizAnswerBotCommand>();
        services.AddScoped<IBotCommand, TranslateManuallyCommand>();
        services.AddScoped<IBotCommand, TranslateCommand>();
        return services;
    }
}