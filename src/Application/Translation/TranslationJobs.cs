using Application.Common;
using Application.Translation.Pipeline;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Application.Translation;

/// <summary>One translation running in this instance, as seen by whoever waits for it.</summary>
public sealed class TranslationJob
{
    private readonly TaskCompletionSource _done = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource _noticeSent = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource _queued = new(TaskCreationOptions.RunContinuationsAsynchronously);

    internal TranslationJob(Task<CreateVocabularyEntryResult> translation, Task verbLookupStarted)
    {
        Translation = translation;
        VerbLookupStarted = verbLookupStarted;
    }

    /// <summary>
    /// What <see cref="TranslateAndCreateVocabularyEntry"/> answered in this instance's own run; faulted
    /// or cancelled when it did not. For a job on record (<see cref="QueuedId"/>) the record has the
    /// last word: a failed run may be followed by another.
    /// </summary>
    public Task<CreateVocabularyEntryResult> Translation { get; }

    /// <summary>Completes when the request went on to look a verb up (the slow part); never for other texts.</summary>
    public Task VerbLookupStarted { get; }

    /// <summary>The bot: the person has been told «ищу глагол…», so the request need not wait. Never for a quick answer.</summary>
    public Task NoticeSent => _noticeSent.Task;

    /// <summary>
    /// The job took longer than a request waits and has been put on record (or could not be — then
    /// <see cref="QueuedId"/> stays null). Never completes for a job that was answered sooner.
    /// </summary>
    public Task Queued => _queued.Task;

    /// <summary>The durable record of this job (<see cref="QueuedTranslation"/>), once there is one.</summary>
    public Guid? QueuedId { get; private set; }

    /// <summary>This instance's run and the reply after it are over, whichever way. Never faults.</summary>
    public Task Completion => _done.Task;

    internal DateTime? FinishedAtUtc { get; private set; }

    internal void MarkNoticeSent() => _noticeSent.TrySetResult();

    internal void MarkQueued(Guid? id)
    {
        QueuedId = id;
        _queued.TrySetResult();
    }

    internal void Finish()
    {
        FinishedAtUtc = DateTime.UtcNow;
        _done.TrySetResult();
    }
}

/// <summary>
/// How the person who asked in the bot is told. One per run; made inside the run's own DI scope.
/// Implemented in Infrastructure (Telegram).
/// </summary>
public interface ITranslationReply
{
    /// <summary>Writes where the answer goes into the durable record, so that another instance can send it.</summary>
    void Describe(QueuedTranslation queued);

    /// <summary>«печатает…» until cancelled. Never fails.</summary>
    Task KeepTypingAsync(CancellationToken stop);

    /// <summary>«Ищу этот глагол…»</summary>
    Task SendNoticeAsync(CancellationToken ct);

    /// <param name="late">The answer comes after the notice or from a later run: it quotes the word it is for.</param>
    Task SendAnswerAsync(CreateVocabularyEntryResult result, bool late, CancellationToken ct);

    /// <summary>«Не успел найти перевод…» — there will be no answer.</summary>
    Task SendNotInTimeAsync(CancellationToken ct);

    /// <summary>The run failed and nothing will repeat it.</summary>
    Task SendErrorAsync(Exception error, CancellationToken ct);
}

/// <summary>Builds the bot's reply for a record taken over from another run. Implemented in Infrastructure.</summary>
public interface ITranslationReplies
{
    /// <summary>Null when there is nobody to answer any more (the user is gone).</summary>
    Task<ITranslationReply?> RestoreAsync(IServiceProvider services, QueuedTranslation queued, CancellationToken ct);
}

/// <summary>
/// Runs a translation apart from the HTTP request that asked for it. A verb that is in neither the base
/// nor Wiktionary takes the models up to a minute or two; Telegram and the ingress close a connection
/// after about a minute, and the request's token and DI scope die with it. Here the work has its own
/// scope and its own token, so it is finished and answered whatever happens to the request.
/// <para>
/// A translation that is answered within a few seconds (<see cref="TranslationAgentOptions.SlowReplyNoticeMs"/>
/// for the bot, <see cref="TranslationAgentOptions.MiniAppTranslateWaitMs"/> for the mini-app) lives in
/// this process only and touches nothing else — it is as quick as it always was. One that takes longer
/// is put on record (<see cref="QueuedTranslation"/>) and a background job is queued for it
/// (<see cref="ITranslationJobQueue"/>), while the work itself simply goes on here, holding the record's
/// lease. The background job, on whichever instance picks it up, watches the record
/// (<see cref="ResumeAsync"/>): when the lease runs out — the working instance died — or is given up —
/// it is restarting, or the run failed — the job starts the translation again and answers. So the
/// person always gets an answer, and the record's conditional updates keep it a single one.
/// </para>
/// Service per ARCHITECTURE.md; singleton.
/// </summary>
public class TranslationJobs(
    IServiceScopeFactory scopes,
    ITranslationJobStore store,
    ITranslationJobQueue queue,
    IOptions<TranslationAgentOptions> options,
    ILogger<TranslationJobs> logger)
{
    /// <summary>Every model step has its own timeout; together they stay well under this. A backstop only.</summary>
    private static readonly TimeSpan MaxJobTime = TimeSpan.FromMinutes(5);

    /// <summary>How long a finished job is kept for the mini-app to pick its answer up.</summary>
    public static readonly TimeSpan KeepResultFor = TimeSpan.FromMinutes(5);

    /// <summary>
    /// An unfinished record older than this is nobody's work any more (all its runs together cannot
    /// take that long): the mini-app may start the word anew.
    /// </summary>
    private static readonly TimeSpan JoinWindow = TimeSpan.FromMinutes(20);

    /// <summary>
    /// A record this old is not worked on any more — the queue stood for a day (both instances down, a
    /// rollback to a version without it): an answer now would come out of nowhere. It is closed silently.
    /// </summary>
    private static readonly TimeSpan AbandonAfter = TimeSpan.FromHours(24);

    /// <summary>This application instance, as the owner of leases.</summary>
    private readonly Guid _instance = Guid.NewGuid();

    private readonly CancellationTokenSource _stopping = new();
    private readonly Dictionary<TranslationJob, byte> _running = new();
    private readonly Dictionary<(Guid UserId, string Word), TranslationJob> _byWord = new();
    private readonly object _lock = new();

    private enum RunEnd
    {
        /// <summary>The person has been answered, or told there is no answer.</summary>
        Finished,

        /// <summary>The run failed or was stopped; the record is free for the next one.</summary>
        LeftForAnotherRun,

        /// <summary>Another instance holds the record now: this run sends nothing.</summary>
        LeaseLost
    }

    /// <summary>What one run works with.</summary>
    private sealed class Run
    {
        public required IServiceProvider Services { get; init; }
        public required Guid UserId { get; init; }
        public required string Word { get; init; }
        public required QueuedTranslationSource Source { get; init; }
        public required DateTime AskedAtUtc { get; init; }
        public ITranslationReply? Reply { get; init; }

        /// <summary>Completed when a verb is being looked up.</summary>
        public TaskCompletionSource VerbLookup { get; init; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        /// <summary>The first run only: what the waiting request sees.</summary>
        public TranslationJob? Job { get; init; }

        /// <inheritdoc cref="Job"/>
        public TaskCompletionSource<CreateVocabularyEntryResult>? Translation { get; init; }

        /// <summary>Null while the job is not on record: nobody else knows of it.</summary>
        public TranslationLease? Lease { get; set; }

        public bool NoticeSent { get; set; }

        /// <summary>A run of the background job, after another run did not get to the end.</summary>
        public bool Takeover { get; init; }

        /// <summary>The run was cancelled because the application is stopping, not because it failed.</summary>
        public required Func<bool> Restarting { get; init; }
    }

    /// <summary>
    /// Starts translating <paramref name="word"/> for the user and returns at once.
    /// </summary>
    /// <param name="reply">
    /// For a caller that has to answer the person itself after its request is gone (the bot): makes the
    /// reply inside the job's own scope. Without it the answer is only kept (the mini-app asks for it).
    /// </param>
    public TranslationJob Start(Guid userId, string word, Func<IServiceProvider, ITranslationReply>? reply = null)
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
            _ = Task.Run(() => RunFirst(job, userId, word, translation, verbLookup, reply));
        }

        return job;
    }

    /// <summary>
    /// The mini-app's entry: the job for this user and word that is running here (or just finished and
    /// not yet picked up), or a new one. A repeated request joins the work instead of starting it again —
    /// also when another instance is doing it: then there is no job here, only its record.
    /// </summary>
    public async Task<(TranslationJob? Job, QueuedTranslation? Elsewhere)> StartOrJoinAsync(Guid userId, string word, CancellationToken ct)
    {
        var key = (userId, Normalize(word));
        lock (_lock)
        {
            var expired = DateTime.UtcNow - KeepResultFor;
            foreach (var stale in _byWord.Where(j => j.Value.FinishedAtUtc < expired).Select(j => j.Key).ToList())
            {
                _byWord.Remove(stale);
            }

            if (_byWord.TryGetValue(key, out var mine))
            {
                return (mine, null);
            }
        }

        var queued = await FindQueuedAsync(userId, word, ct);
        if (queued is { IsFinished: false } && queued.CreatedAtUtc > DateTime.UtcNow - JoinWindow)
        {
            return (null, queued);
        }

        lock (_lock)
        {
            if (!_byWord.TryGetValue(key, out var job))
            {
                _byWord[key] = job = Start(userId, word);
            }

            return (job, null);
        }
    }

    /// <summary>The job <see cref="StartOrJoinAsync"/> started in this process for the user and word, if it is still known.</summary>
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

    /// <summary>The durable record of a job, by its id. Null when there is none — or the database cannot be asked.</summary>
    public async Task<QueuedTranslation?> FindQueuedAsync(Guid id, CancellationToken ct)
    {
        try
        {
            return await store.FindAsync(id, ct);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Translation jobs: the record could not be read ({Error})", e.GetType().Name);
            return null;
        }
    }

    /// <summary>
    /// The latest durable record of the user's word, whichever instance works on it — what an instance
    /// that never had the job answers the mini-app from. Null when there is none worth answering from:
    /// a finished one is kept for <see cref="KeepResultFor"/>.
    /// </summary>
    public async Task<QueuedTranslation?> FindQueuedAsync(Guid userId, string word, CancellationToken ct)
    {
        QueuedTranslation? queued;
        try
        {
            queued = await store.FindLatestAsync(userId, Normalize(word), ct);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Translation jobs: the record could not be read ({Error})", e.GetType().Name);
            return null;
        }

        return queued is { IsFinished: true } && queued.FinishedAtUtc < DateTime.UtcNow - KeepResultFor ? null : queued;
    }

    /// <summary>
    /// Application shutdown: lets the jobs running here finish for <paramref name="grace"/>, then stops
    /// the rest. A job on record is left for another instance (or this one, restarted) to do again; one
    /// that is not — it had only just begun — tells the person, as nobody else knows of it.
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
            logger.LogWarning("Translation jobs still running at shutdown: they are stopped here and left for another instance");
            await _stopping.CancelAsync();
            await Task.WhenAny(all, Task.Delay(farewell));
        }
    }

    /// <summary>
    /// The background job's work, on whichever instance picked it up: stands guard over a record until
    /// the person is answered. While a live instance holds the lease it only watches; when the record is
    /// free (the lease ran out or was given up) it runs the translation itself. Returns when the record
    /// is finished — at once, sending nothing, if it already was. After
    /// <see cref="TranslationAgentOptions.JobMaxAttempts"/> starts it gives up and says so.
    /// </summary>
    /// <param name="stop">The worker is stopping: the record is released and the queue delivers the job again.</param>
    public async Task ResumeAsync(Guid queuedTranslationId, CancellationToken stop)
    {
        var failures = 0;
        while (true)
        {
            stop.ThrowIfCancellationRequested();
            var o = options.Value;
            var queued = await store.FindAsync(queuedTranslationId, stop);
            if (queued == null || queued.IsFinished)
            {
                return;
            }

            var lease = await store.TryClaimAsync(queuedTranslationId, _instance, TimeSpan.FromMilliseconds(o.JobLeaseMs), stop);
            if (lease == null)
            {
                await Task.Delay(Math.Max(1, o.JobPollMs), stop);
                continue;
            }

            logger.LogWarning("Translation job {Id}: taken over, start {Attempt}", queuedTranslationId, lease.Value.Attempt);
            var end = await RunAgain(queued, lease.Value, stop);
            stop.ThrowIfCancellationRequested();
            if (end == RunEnd.Finished)
            {
                return;
            }

            if (end == RunEnd.LeftForAnotherRun)
            {
                await Task.Delay(Math.Max(0, o.JobRetryDelayMs) * ++failures, stop);
            }
        }
    }

    private static string Normalize(string word) => word.Trim().ToLowerInvariant();

    /// <summary>The run that starts with the request, in this instance.</summary>
    private async Task RunFirst(
        TranslationJob job,
        Guid userId,
        string word,
        TaskCompletionSource<CreateVocabularyEntryResult> translation,
        TaskCompletionSource verbLookup,
        Func<IServiceProvider, ITranslationReply>? reply)
    {
        try
        {
            using var limit = CancellationTokenSource.CreateLinkedTokenSource(_stopping.Token);
            limit.CancelAfter(MaxJobTime);
            await using var scope = scopes.CreateAsyncScope();
            await RunOnce(new Run
            {
                Services = scope.ServiceProvider,
                UserId = userId,
                Word = word,
                Source = reply == null ? QueuedTranslationSource.MiniApp : QueuedTranslationSource.Bot,
                AskedAtUtc = DateTime.UtcNow,
                Reply = reply?.Invoke(scope.ServiceProvider),
                VerbLookup = verbLookup,
                Job = job,
                Translation = translation,
                Restarting = () => _stopping.IsCancellationRequested
            }, limit.Token);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Translation job failed");
        }
        finally
        {
            // Whatever happened, nobody waits for ever — and a fault nobody awaited (the mini-app went
            // away) must not surface as an unobserved exception.
            translation.TrySetCanceled();
            _ = translation.Task.Exception;
            lock (_lock)
            {
                _running.Remove(job);
            }

            job.Finish();
        }
    }

    /// <summary>A run of the background job over a record it has just claimed.</summary>
    private async Task<RunEnd> RunAgain(QueuedTranslation queued, TranslationLease lease, CancellationToken stop)
    {
        var o = options.Value;
        await using var scope = scopes.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var reply = queued.Source == QueuedTranslationSource.Bot
            ? await services.GetRequiredService<ITranslationReplies>().RestoreAsync(services, queued, stop)
            : null;

        var abandoned = queued.CreatedAtUtc < DateTime.UtcNow - AbandonAfter;
        if (abandoned || lease.Attempt > Math.Max(1, o.JobMaxAttempts) || (reply == null && queued.Source == QueuedTranslationSource.Bot))
        {
            logger.LogError("Translation job {Id}: given up after {Attempts} starts (asked at {AskedAt:u})", queued.Id, lease.Attempt - 1, queued.CreatedAtUtc);
            if (reply != null && !abandoned)
            {
                if (!await store.BeginAnswerAsync(lease, TimeSpan.FromMilliseconds(o.JobLeaseMs), stop))
                {
                    return RunEnd.LeaseLost;
                }

                await reply.SendNotInTimeAsync(stop);
            }

            await store.FinishAsync(lease, QueuedTranslationState.Failed, QueuedTranslationOutcome.Failure, null, CancellationToken.None);
            return RunEnd.Finished;
        }

        using var limit = CancellationTokenSource.CreateLinkedTokenSource(stop);
        limit.CancelAfter(MaxJobTime);
        var run = new Run
        {
            Services = services,
            UserId = queued.UserId,
            Word = queued.Word,
            Source = queued.Source,
            AskedAtUtc = queued.CreatedAtUtc,
            Reply = reply,
            Lease = lease,
            NoticeSent = queued.NoticeSent,
            Takeover = true,
            Restarting = () => stop.IsCancellationRequested
        };
        if (queued.VerbLookup)
        {
            run.VerbLookup.TrySetResult();
        }

        return await RunOnce(run, limit.Token);
    }

    /// <summary>
    /// One run: translate, tell the person. A run that is not on record when it starts (the first one)
    /// goes on record once it has taken longer than a request waits.
    /// </summary>
    /// <param name="stop">The application (or the worker) is stopping, or the run hit its time limit.</param>
    private async Task<RunEnd> RunOnce(Run run, CancellationToken stop)
    {
        var o = options.Value;
        var leaseTime = TimeSpan.FromMilliseconds(o.JobLeaseMs);
        // Cancelled by the caller — or by the heartbeat, when the lease turns out to be somebody else's.
        using var work = CancellationTokenSource.CreateLinkedTokenSource(stop);
        var token = work.Token;
        var heartbeat = run.Lease is { } held ? KeepLease(held, work) : Task.CompletedTask;
        try
        {
            run.Services.GetRequiredService<TranslationRequester>().VerbLookupStarted = () =>
            {
                if (run.VerbLookup.TrySetResult() && run.Lease is { } known)
                {
                    _ = Quietly(() => store.MarkVerbLookupAsync(known.Id, CancellationToken.None));
                }
            };

            var translating = Translate(run, token);
            CreateVocabularyEntryResult result;
            using (var typing = CancellationTokenSource.CreateLinkedTokenSource(token))
            {
                // The chat shows «печатает…» from the first moment until the reply, so a slow step never
                // looks like silence.
                var indicator = run.Reply?.KeepTypingAsync(typing.Token) ?? Task.CompletedTask;
                try
                {
                    var slow = run.Takeover;
                    if (!slow)
                    {
                        var patience = Task.Delay(
                            Math.Max(0, run.Source == QueuedTranslationSource.Bot ? o.SlowReplyNoticeMs : o.MiniAppTranslateWaitMs),
                            typing.Token);
                        slow = await Task.WhenAny(translating, patience) != translating && patience.IsCompletedSuccessfully;
                        if (slow)
                        {
                            run.Lease = await PutOnRecord(run, leaseTime, token);
                            if (run.Lease is { } recorded)
                            {
                                heartbeat = KeepLease(recorded, work);
                                if (run.VerbLookup.Task.IsCompleted)
                                {
                                    await Quietly(() => store.MarkVerbLookupAsync(recorded.Id, token));
                                }
                            }

                            run.Job?.MarkQueued(run.Lease?.Id);
                        }
                    }

                    // A verb that is still being looked up gets a message saying so; everything else is
                    // answered before that and looks as it always did.
                    if (slow && run.Reply != null && !run.NoticeSent
                        && await Task.WhenAny(translating, run.VerbLookup.Task) != translating && !translating.IsCompleted)
                    {
                        try
                        {
                            await run.Reply.SendNoticeAsync(token);
                        }
                        catch (Exception) when (!token.IsCancellationRequested)
                        {
                            // The notice is a courtesy: the answer itself must still be sent.
                        }

                        run.NoticeSent = true;
                        if (run.Lease is { } noticed)
                        {
                            await Quietly(() => store.MarkNoticeSentAsync(noticed.Id, token));
                        }

                        run.Job?.MarkNoticeSent();
                    }

                    result = await translating;
                }
                finally
                {
                    typing.Cancel();
                    await indicator;
                }
            }

            if (run.Takeover && result is CreateVocabularyEntryResult.TranslationExists exists && await SavedByEarlierRun(run, exists, token))
            {
                // The run before this one saved the word and did not get to say so: for the person it is new.
                result = new CreateVocabularyEntryResult.TranslationSuccess(
                    exists.Definition, exists.AdditionalInfo, exists.Example, exists.VocabularyEntryId);
            }

            if (run.Reply != null)
            {
                // The one moment that must not happen twice: only the run that still holds the record may send.
                if (run.Lease is { } answering && !await store.BeginAnswerAsync(answering, leaseTime, token))
                {
                    return RunEnd.LeaseLost;
                }

                await run.Reply.SendAnswerAsync(result, late: run.NoticeSent || run.Takeover, token);
            }

            if (run.Lease is { } done)
            {
                var (outcome, entryId) = Outcome(result);
                await store.FinishAsync(done, QueuedTranslationState.Done, outcome, entryId, CancellationToken.None);
            }

            return RunEnd.Finished;
        }
        catch (OperationCanceledException) when (work.IsCancellationRequested)
        {
            if (run.Lease is { } left)
            {
                if (!stop.IsCancellationRequested)
                {
                    return RunEnd.LeaseLost;
                }

                // Stopped midway: the record is given up at once, and the background job — here after the
                // restart, or on another instance — does the work again. Nothing is said to the person yet.
                await Quietly(() => store.ReleaseAsync(left, uncount: run.Restarting(), CancellationToken.None));
                return RunEnd.LeftForAnotherRun;
            }

            // Not on record: nobody will do it again, and the request that could have reported it may be
            // long gone, so the person is told here.
            if (run.Reply != null)
            {
                using var farewell = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await run.Reply.SendNotInTimeAsync(farewell.Token);
            }

            return RunEnd.Finished;
        }
        catch (Exception e)
        {
            if (run.Lease is { } failed)
            {
                logger.LogWarning(e, "Translation job {Id}: start {Attempt} failed", failed.Id, failed.Attempt);
                await Quietly(() => store.ReleaseAsync(failed, uncount: false, CancellationToken.None));
                return RunEnd.LeftForAnotherRun;
            }

            if (run.Reply != null)
            {
                await run.Reply.SendErrorAsync(e, token);
            }
            else
            {
                logger.LogError(e, "Translation job failed");
            }

            return RunEnd.Finished;
        }
        finally
        {
            await work.CancelAsync();
            await heartbeat;
        }
    }

    private async Task<CreateVocabularyEntryResult> Translate(Run run, CancellationToken token)
    {
        try
        {
            var result = await run.Services.GetRequiredService<IMediator>().Send(
                new TranslateAndCreateVocabularyEntry { UserId = run.UserId, Word = run.Word }, token);
            run.Translation?.TrySetResult(result);
            return result;
        }
        catch (Exception e)
        {
            run.Translation?.TrySetException(e);
            throw;
        }
    }

    /// <summary>
    /// Writes the durable record of a run that is taking long, with this instance as the holder, and
    /// queues the background job that stands guard over it. Null when the database refused: the job
    /// then goes on in memory only, as it would have without a queue.
    /// </summary>
    private async Task<TranslationLease?> PutOnRecord(Run run, TimeSpan leaseTime, CancellationToken token)
    {
        var queued = new QueuedTranslation
        {
            Id = Guid.NewGuid(),
            Source = run.Source,
            UserId = run.UserId,
            Word = run.Word,
            WordKey = Normalize(run.Word),
            State = QueuedTranslationState.Pending,
            VerbLookup = run.VerbLookup.Task.IsCompleted,
            Attempts = 1,
            LeaseOwner = _instance,
            LeaseUntilUtc = DateTime.UtcNow + leaseTime,
            CreatedAtUtc = run.AskedAtUtc
        };
        run.Reply?.Describe(queued);
        try
        {
            await store.CreateAsync(queued, token);
        }
        catch (Exception e) when (!token.IsCancellationRequested)
        {
            logger.LogError(e, "Translation job could not be put on record: it goes on in this instance only");
            return null;
        }

        try
        {
            queue.Enqueue(queued.Id);
        }
        catch (Exception e)
        {
            // The record is there and this run goes on; only the guard against this instance dying is missing.
            logger.LogError(e, "Translation job {Id}: the background job could not be queued", queued.Id);
        }

        return new TranslationLease(queued.Id, _instance, 1);
    }

    /// <summary>The sign of life while a run works. Cancels the run when the lease is no longer its own.</summary>
    private async Task KeepLease(TranslationLease lease, CancellationTokenSource work)
    {
        var o = options.Value;
        var token = work.Token;
        try
        {
            while (true)
            {
                await Task.Delay(Math.Max(1, o.JobLeaseRenewMs), token);
                try
                {
                    if (!await store.RenewAsync(lease, TimeSpan.FromMilliseconds(o.JobLeaseMs), token))
                    {
                        if (!token.IsCancellationRequested)
                        {
                            logger.LogWarning("Translation job {Id}: start {Attempt} lost its lease and stops", lease.Id, lease.Attempt);
                            await work.CancelAsync();
                        }

                        return;
                    }
                }
                catch (Exception e) when (!token.IsCancellationRequested)
                {
                    logger.LogWarning("Translation job {Id}: the lease could not be renewed ({Error})", lease.Id, e.GetType().Name);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // The run is over.
        }
        catch (ObjectDisposedException)
        {
            // The run is over.
        }
    }

    private static async Task<bool> SavedByEarlierRun(Run run, CreateVocabularyEntryResult.TranslationExists exists, CancellationToken ct)
    {
        var db = run.Services.GetRequiredService<ITraleDbContext>();
        return await db.VocabularyEntries.AnyAsync(
            e => e.Id == exists.VocabularyEntryId && e.DateAddedUtc >= run.AskedAtUtc, ct);
    }

    private static (string Outcome, Guid? VocabularyEntryId) Outcome(CreateVocabularyEntryResult result) => result switch
    {
        CreateVocabularyEntryResult.TranslationSuccess s => (QueuedTranslationOutcome.Success, s.VocabularyEntryId),
        CreateVocabularyEntryResult.TranslationExists e => (QueuedTranslationOutcome.Exists, e.VocabularyEntryId),
        CreateVocabularyEntryResult.NotTranslatable => (QueuedTranslationOutcome.NotAWord, null),
        CreateVocabularyEntryResult.PromptLengthExceeded => (QueuedTranslationOutcome.TooLong, null),
        CreateVocabularyEntryResult.EmojiDetected => (QueuedTranslationOutcome.Emoji, null),
        _ => (QueuedTranslationOutcome.Failure, null)
    };

    /// <summary>A bookkeeping write that must not break the run it belongs to.</summary>
    private async Task Quietly(Func<Task> write)
    {
        try
        {
            await write();
        }
        catch (Exception e)
        {
            logger.LogWarning("Translation jobs: a record update failed ({Error})", e.GetType().Name);
        }
    }
}
