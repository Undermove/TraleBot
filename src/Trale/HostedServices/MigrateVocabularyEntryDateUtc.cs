using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Infrastructure.Telegram;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Telegram.Bot;

namespace Trale.HostedServices;

public class MigrateVocabularyEntryDateUtc : IHostedService
{
    private readonly ITraleDbContext _traleDbContext;

    public MigrateVocabularyEntryDateUtc(ITraleDbContext traleDbContext)
    {
        _traleDbContext = traleDbContext;
    }
        
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var allEntries = await _traleDbContext.VocabularyEntries.ToListAsync(cancellationToken);
        allEntries.ForEach(entry =>
        {
            if (entry.DateAddedUtc == default)
            {
                entry.DateAddedUtc = entry.UpdatedAtUtc;
            }
        });
        await _traleDbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
    }
}