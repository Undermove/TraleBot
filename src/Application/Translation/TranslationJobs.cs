using Application.Translation.Pipeline;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Application.Translation;

/// <summary>One translation running on its own, as seen by whoever waits for it.</summary>
public sealed class TranslationJob
{
    private readonly TaskCompletionSource _done = new(TaskCreationOptions.RunContinuationsAsynchronously);

    internal TranslationJob(Task<CreateVocabularyEntryResult> translation, Task verbLookupStarted)
    {
        Translation = translation;
        VerbLookupStarted = verbLookupStarted;
    }

    /// <summary>What <see cref="TranslateAndCreateVocabularyEntry"/> answered; faulted or cancelled when it did not.</summary>
    public Task<CreateVocabularyEntryResult> Translation { get; }

    /// <summary>Completes when the request went on to look a verb up (the slow part); never for other texts.</summary>
    public Task VerbLookupStarted { get; }

    /// <summary>The furthest step the translation has reported so far.</summary>
    public TranslationStage Stage => Progress.Stage;

    internal TranslationProgress Progress { get; } = new();

    /// <summary>The translation and the reply after it are over, whichever way. Never faults.</summary>
    public Task Completion => _done.Task;

    internal DateTime? FinishedAtUtc { get; private set; }

    internal void Finish()
    {
        FinishedAtUtc = DateTime.UtcNow;
        _done.TrySetResult();
    }
}

/// <summary>
/// Runs a translation apart from the HTTP request that asked for it. A verb that is in neither the base
/// nor Wiktionary takes the models up to a minute or two; Telegram and the ingress close a connection
/// after about a minute, and the request's token and DI scope die with it. Here the work has its own
/// scope and its own token, so it is finished and answered whatever happens to the request.
/// <para>
/// The jobs live in this process only. When the application stops, they get a grace period and are then
/// cancelled (<see cref="StopAsync"/>) — the caller's reply delegate sees the cancellation and can say
/// so. A killed process loses its jobs: the person has to send the word again.
/// </para>
/// Service per ARCHITECTURE.md; singleton.
/// </summary>
public class TranslationJobs(IServiceScopeFactory scopes, ILogger<TranslationJobs> logger)
{
    /// <summary>Every model step has its own timeout; together they stay well under this. A backstop only.</summary>
    private static readonly TimeSpan MaxJobTime = TimeSpan.FromMinutes(5);

    /// <summary>How long a finished job is kept for the mini-app to pick its answer up.</summary>
    private static readonly TimeSpan KeepResultFor = TimeSpan.FromMinutes(5);

    private readonly CancellationTokenSource _stopping = new();
    private readonly Dictionary<TranslationJob, byte> _running = new();
    private readonly Dictionary<(Guid UserId, string Word), TranslationJob> _byWord = new();
    private readonly object _lock = new();

    /// <summary>
    /// Starts translating <paramref name="word"/> for the user and returns at once.
    /// </summary>
    /// <param name="reply">
    /// Runs next to the translation, in the job's own scope and with the job's token — for a caller
    /// that has to answer the person itself after its request is gone (the bot). It is started before
    /// the translation is ready and awaits <see cref="TranslationJob.Translation"/> on its own.
    /// </param>
    public TranslationJob Start(
        Guid userId, string word, Func<IServiceProvider, TranslationJob, CancellationToken, Task>? reply = null)
    {
        var translation = new TaskCompletionSource<CreateVocabularyEntryResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        var verbLookup = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var job = new TranslationJob(translation.Task, verbLookup.Task);
        lock (_lock)
        {
            _running[job] = 0;
        }

        // The job must not inherit what belongs to the request (its HttpContext, its log scopes).
        using (ExecutionContext.SuppressFlow())
        {
            _ = Task.Run(() => Run(job, userId, word, translation, verbLookup, reply));
        }

        return job;
    }

    /// <summary>
    /// The mini-app's entry: the running (or just finished, not yet picked up) job for this user and
    /// word, or a new one. A repeated request joins the work instead of starting it again.
    /// </summary>
    public TranslationJob StartOrJoin(Guid userId, string word)
    {
        var key = (userId, Normalize(word));
        lock (_lock)
        {
            var expired = DateTime.UtcNow - KeepResultFor;
            foreach (var stale in _byWord.Where(j => j.Value.FinishedAtUtc < expired).Select(j => j.Key).ToList())
            {
                _byWord.Remove(stale);
            }

            if (!_byWord.TryGetValue(key, out var job))
            {
                _byWord[key] = job = Start(userId, word);
            }

            return job;
        }
    }

    /// <summary>The job <see cref="StartOrJoin"/> started in this process for the user and word, if it is still known.</summary>
    public TranslationJob? Find(Guid userId, string word)
    {
        lock (_lock)
        {
            return _byWord.GetValueOrDefault((userId, Normalize(word)));
        }
    }

    /// <summary>The job's answer has been handed to the mini-app: the next request for the word starts anew.</summary>
    public void Forget(Guid userId, string word)
    {
        lock (_lock)
        {
            _byWord.Remove((userId, Normalize(word)));
        }
    }

    /// <summary>
    /// Application shutdown: lets the running jobs finish for <paramref name="grace"/>, then cancels the
    /// rest and gives their reply delegates a moment to tell the person.
    /// </summary>
    public async Task StopAsync(TimeSpan grace, TimeSpan farewell)
    {
        Task all;
        lock (_lock)
        {
            all = Task.WhenAll(_running.Keys.Select(j => j.Completion).ToList());
        }

        if (await Task.WhenAny(all, Task.Delay(grace)) != all)
        {
            logger.LogWarning("Translation jobs still running at shutdown: they are cancelled");
            await _stopping.CancelAsync();
            await Task.WhenAny(all, Task.Delay(farewell));
        }
    }

    private static string Normalize(string word) => word.Trim().ToLowerInvariant();

    private async Task Run(
        TranslationJob job,
        Guid userId,
        string word,
        TaskCompletionSource<CreateVocabularyEntryResult> translation,
        TaskCompletionSource verbLookup,
        Func<IServiceProvider, TranslationJob, CancellationToken, Task>? reply)
    {
        try
        {
            using var limit = CancellationTokenSource.CreateLinkedTokenSource(_stopping.Token);
            limit.CancelAfter(MaxJobTime);
            await using var scope = scopes.CreateAsyncScope();
            var services = scope.ServiceProvider;
            services.GetRequiredService<TranslationRequester>().VerbLookupStarted = () => verbLookup.TrySetResult();
            services.GetRequiredService<TranslationRequester>().Progress = job.Progress;

            var replying = reply?.Invoke(services, job, limit.Token);
            try
            {
                translation.TrySetResult(await services.GetRequiredService<IMediator>().Send(
                    new TranslateAndCreateVocabularyEntry { UserId = userId, Word = word }, limit.Token));
            }
            catch (Exception e)
            {
                translation.TrySetException(e);
            }

            if (replying != null)
            {
                await replying;
            }
        }
        catch (Exception e)
        {
            translation.TrySetException(e);
            logger.LogError(e, "Translation job failed");
        }
        finally
        {
            // A fault nobody awaited (the mini-app went away) must not surface as an unobserved exception.
            _ = translation.Task.Exception;
            lock (_lock)
            {
                _running.Remove(job);
            }

            job.Finish();
        }
    }
}
