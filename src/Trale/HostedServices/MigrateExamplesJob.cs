using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace Trale.HostedServices;

public class MigrateExamplesJob : IHostedService
{
    private readonly ITraleDbContext _context;
    private readonly ITranslationService _translationService;

    public MigrateExamplesJob(ITraleDbContext context, ITranslationService translationService)
    {
        _context = context;
        _translationService = translationService;
    }
        
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var vocabularyEntries = await _context.VocabularyEntries.ToArrayAsync(cancellationToken: cancellationToken);
        foreach (var vocabularyEntry in vocabularyEntries)
        {
            if (!string.IsNullOrEmpty(vocabularyEntry.Example)) { continue; }
            
            var translationResult = await _translationService.TranslateAsync(vocabularyEntry.Word, cancellationToken);
            
            if (!translationResult.IsSuccessful) { continue; }
            
            vocabularyEntry.Example = translationResult.Example;
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}