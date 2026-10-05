using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Verbs;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trale.HostedServices;

/// <summary>
/// On startup reads the comic stories (<c>Verbs/stories/*.json</c>) and resolves their lines against the
/// curated verb catalog (<c>Verbs/verbs.json</c>). A story that does not resolve — unknown sentence id,
/// a form that is not a form of its verb — is logged and skipped; nothing here can take the bot down.
/// </summary>
public class LoadVerbStories(VerbStoryCatalog stories, ILogger<LoadVerbStories> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var catalogPath = Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json");
            var storiesDir = Path.Combine(AppContext.BaseDirectory, "Verbs", "stories");
            if (!File.Exists(catalogPath) || !Directory.Exists(storiesDir))
            {
                logger.LogWarning("Verb stories or the verb catalog not found under {Dir}; no stories loaded", storiesDir);
                return;
            }

            var files = Directory.GetFiles(storiesDir, "*.json").ToDictionary(
                path => Path.GetFileNameWithoutExtension(path)!,
                File.ReadAllText);
            var result = stories.Load(await File.ReadAllTextAsync(catalogPath, cancellationToken), files);

            foreach (var error in result.Errors)
            {
                logger.LogError("Verb story skipped — {Error}", error);
            }

            logger.LogInformation("Verb stories: {Loaded} of {Total} loaded", result.Stories.Count, files.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to load verb stories");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
