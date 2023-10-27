using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Infrastructure.Telegram;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Telegram.Bot;

namespace Trale.HostedServices;

public class PopulateUsersWithSettings : IHostedService
{
    private readonly ITraleDbContext _context;
    private readonly BotConfiguration _config;
    private readonly ITelegramBotClient _telegramBotClient;

    public PopulateUsersWithSettings(BotConfiguration config, ITelegramBotClient telegramBotClient, ITraleDbContext context)
    {
        _config = config;
        _telegramBotClient = telegramBotClient;
        _context = context;
    }
        
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var users = await _context.Users.ToListAsync(cancellationToken);
        var result = users
            .Select(user => new UserSettings
            {
                Id = Guid.NewGuid(), 
                CurrentLanguage = Language.English, 
                UserId = user.Id, 
                User = user
            }).ToList();
        
        await _context.UsersSettings.AddRangeAsync(result, cancellationToken);
        
        _context.Users.UpdateRange(users.Select(user =>
        {
            user.UserSettingsId = result.First(settings => settings.UserId == user.Id).Id;
            return user;
        }));
        
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(_config.HostAddress))
        {
            // set first parameter to true in critical situations
            await _telegramBotClient.DeleteWebhookAsync(false, cancellationToken);
        }
    }
}