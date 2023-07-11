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
        services.AddTransient<ITranslationService, WooordHuntParsingTranslationService>();
        services.AddTransient<IOpenAiHttpClient, OpenAiHttpClient>();
        services.AddHttpClient();

        services.AddSingleton<IPrometheusResolver, PrometheusResolver>();
        
        var botConfig = configuration.GetSection("BotConfiguration").Get<BotConfiguration>();
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
        
        services.AddSingleton<IDialogProcessor, TelegramDialogProcessor>();
        services.AddSingleton<IBotCommand, StartCommand>();
        services.AddSingleton<IBotCommand, HelpCommand>();
        services.AddSingleton<IBotCommand, MenuCommand>();
        services.AddSingleton<IBotCommand, CloseMenuCommand>();
        services.AddSingleton<IBotCommand, AcceptCheckoutCommand>();
        services.AddSingleton<IBotCommand, PayCommand>();
        services.AddSingleton<IBotCommand, RequestInvoiceCommand>();
        services.AddSingleton<IBotCommand, OfferTrialCommand>();
        services.AddSingleton<IBotCommand, ActivateTrialCommand>();
        services.AddSingleton<IBotCommand, VocabularyCommand>();
        services.AddSingleton<IBotCommand, AchievementsCommand>();
        services.AddSingleton<IBotCommand, QuizCommand>();
        services.AddSingleton<IBotCommand, StartQuizBotCommand>();
        services.AddSingleton<IBotCommand, StopQuizBotCommand>();
        services.AddSingleton<IBotCommand, RemoveEntryCommand>();
        services.AddSingleton<IBotCommand, CheckQuizAnswerBotCommand>();
        services.AddSingleton<IBotCommand, TranslateManuallyCommand>();
        services.AddSingleton<IBotCommand, TranslateCommand>();
        return services;
    }
}