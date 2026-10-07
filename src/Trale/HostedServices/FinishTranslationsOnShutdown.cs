using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Translation;
using Microsoft.Extensions.Hosting;

namespace Trale.HostedServices;

/// <summary>
/// On shutdown (a rolling deploy) gives the translations that are still running in this instance
/// (<see cref="TranslationJobs"/>) time to finish and answer; what is not done by then is stopped here
/// and left on record for the job queue to do again — on the other instance, or on this one after the
/// restart. Only a translation too young to be on record tells the person to send the word again. Both
/// waits together stay under the host's 30-second shutdown timeout and Kubernetes' default termination
/// grace period.
/// </summary>
public class FinishTranslationsOnShutdown(TranslationJobs jobs) : IHostedService
{
    private static readonly TimeSpan Grace = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan Farewell = TimeSpan.FromSeconds(5);

    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public Task StopAsync(CancellationToken cancellationToken) => jobs.StopAsync(Grace, Farewell);
}
