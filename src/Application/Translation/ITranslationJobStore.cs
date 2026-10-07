using Domain.Entities;

namespace Application.Translation;

/// <summary>A run's right to work on a <see cref="QueuedTranslation"/>: who holds the lease and which start it is.</summary>
public readonly record struct TranslationLease(Guid Id, Guid Owner, int Attempt);

/// <summary>
/// The durable side of <see cref="TranslationJobs"/>: <see cref="QueuedTranslation"/> rows and their
/// lease. Every change a run makes is one conditional UPDATE that succeeds only while the run still
/// holds the lease — so two instances can never both answer. Implemented in Persistence; each call
/// uses a database context of its own (the callers outlive requests).
/// </summary>
public interface ITranslationJobStore
{
    /// <summary>Records a translation already running in this instance (the lease is the caller's, attempt 1).</summary>
    Task CreateAsync(QueuedTranslation queued, CancellationToken ct);

    Task<QueuedTranslation?> FindAsync(Guid id, CancellationToken ct);

    /// <summary>The latest record of the user's word, if any.</summary>
    Task<QueuedTranslation?> FindLatestAsync(Guid userId, string wordKey, CancellationToken ct);

    /// <summary>
    /// Takes an unfinished record nobody alive is working on. Null when it is finished or somebody
    /// holds it; otherwise the lease, with the number of this start.
    /// </summary>
    Task<TranslationLease?> TryClaimAsync(Guid id, Guid owner, TimeSpan lease, CancellationToken ct);

    /// <summary>The sign of life. False: the lease is lost — somebody else works on it now.</summary>
    Task<bool> RenewAsync(TranslationLease lease, TimeSpan duration, CancellationToken ct);

    /// <summary>
    /// Gives the record up for another run to take at once. <paramref name="uncount"/>: the run was
    /// stopped by a restart, not by a failure, and does not use up an attempt.
    /// </summary>
    Task ReleaseAsync(TranslationLease lease, bool uncount, CancellationToken ct);

    /// <summary>The answer is about to be sent. False: the lease is lost, and the caller must not send.</summary>
    Task<bool> BeginAnswerAsync(TranslationLease lease, TimeSpan duration, CancellationToken ct);

    /// <summary>Final: the person has the answer (or, for <see cref="QueuedTranslationState.Failed"/>, was told there is none).</summary>
    Task<bool> FinishAsync(
        TranslationLease lease, QueuedTranslationState state, string outcome, Guid? vocabularyEntryId, CancellationToken ct);

    Task MarkVerbLookupAsync(Guid id, CancellationToken ct);

    Task MarkNoticeSentAsync(Guid id, CancellationToken ct);
}

/// <summary>
/// The durable queue behind <see cref="TranslationJobs"/>: a background job that any instance may pick
/// up and that is delivered again when the instance running it dies. Implemented in Infrastructure.
/// </summary>
public interface ITranslationJobQueue
{
    /// <summary>Queues a job that calls <see cref="TranslationJobs.ResumeAsync"/> for the record.</summary>
    void Enqueue(Guid queuedTranslationId);
}
