using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Application.Verbs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

/// <summary>
/// On startup loads the curated verb catalog (<c>Verbs/verbs.json</c>) into the database, so the
/// "Глаголы" section is served from the DB. A failure here must not take the bot down: the section
/// just stays on the previous catalog.
/// </summary>
public class SeedVerbCatalog(IServiceScopeFactory scopeFactory, ILogger<SeedVerbCatalog> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json");
            if (!File.Exists(path))
            {
                logger.LogWarning("Verb catalog not found at {Path}; skipping seed", path);
                return;
            }

            using var scope = scopeFactory.CreateScope();
            var seeder = scope.ServiceProvider.GetRequiredService<VerbCatalogSeeder>();
            var result = await seeder.SeedAsync(await File.ReadAllTextAsync(path, cancellationToken), cancellationToken);
            logger.LogInformation("Verb catalog: {Total} verbs, {Written} written, {Removed} removed",
                result.Total, result.Written, result.Removed);

            // Model-made verbs stored before tenses had a verification state get one, once.
            var marked = await scope.ServiceProvider.GetRequiredService<VerbVerificationBackfill>().RunAsync(cancellationToken);
            if (marked > 0)
            {
                logger.LogInformation("Model-made verbs brought up to date with a verification state: {Count}", marked);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to seed the verb catalog");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
