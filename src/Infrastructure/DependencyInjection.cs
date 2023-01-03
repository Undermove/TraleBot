using Application.Common;
using Application.Common.Interfaces;
using Infrastructure.Telegram;
using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Persistence;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ITraleDbContext>(provider => provider.GetService<TraleDbContext>() ?? throw new InvalidOperationException());
        
        services.AddSingleton<IDialogProcessor, TelegramDialogProcessor>();
        services.AddSingleton<IBotCommand, StartCommand>();
        return services;
    }
}