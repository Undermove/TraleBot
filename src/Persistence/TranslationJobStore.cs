using Application.Translation;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Persistence;

/// <summary>
/// <see cref="ITranslationJobStore"/> over the <c>QueuedTranslations</c> table. Singleton; a database
/// context per call.
/// </summary>
public class TranslationJobStore(IServiceScopeFactory scopes) : ITranslationJobStore
{
    /// <summary>Records older than this are removed when a new one is written.</summary>
    private static readonly TimeSpan Keep = TimeSpan.FromDays(7);

    public Task CreateAsync(QueuedTranslation queued, CancellationToken ct) => WithDb(async db =>
    {
        var old = DateTime.UtcNow - Keep;
        await db.QueuedTranslations.Where(q => q.CreatedAtUtc < old).ExecuteDeleteAsync(ct);
        db.QueuedTranslations.Add(queued);
        await db.SaveChangesAsync(ct);
        return 0;
    });

    public Task<QueuedTranslation?> FindAsync(Guid id, CancellationToken ct) => WithDb(db =>
        db.QueuedTranslations.AsNoTracking().FirstOrDefaultAsync(q => q.Id == id, ct));

    public Task<QueuedTranslation?> FindLatestAsync(Guid userId, string wordKey, CancellationToken ct) => WithDb(db =>
        db.QueuedTranslations.AsNoTracking()
            .Where(q => q.UserId == userId && q.WordKey == wordKey)
            .OrderByDescending(q => q.CreatedAtUtc)
            .FirstOrDefaultAsync(ct));

    public Task<TranslationLease?> TryClaimAsync(Guid id, Guid owner, TimeSpan lease, CancellationToken ct) => WithDb(async db =>
    {
        var now = DateTime.UtcNow;
        var until = now + lease;
        var claimed = await db.QueuedTranslations
            .Where(q => q.Id == id
                        && (q.State == QueuedTranslationState.Pending || q.State == QueuedTranslationState.Answering)
                        && (q.LeaseUntilUtc == null || q.LeaseUntilUtc < now))
            .ExecuteUpdateAsync(s => s
                .SetProperty(q => q.LeaseOwner, owner)
                .SetProperty(q => q.LeaseUntilUtc, until)
                .SetProperty(q => q.Attempts, q => q.Attempts + 1), ct);
        if (claimed == 0)
        {
            return (TranslationLease?)null;
        }

        // Nobody else can change the number now: the lease is ours.
        var attempt = await db.QueuedTranslations.Where(q => q.Id == id).Select(q => q.Attempts).SingleAsync(ct);
        return new TranslationLease(id, owner, attempt);
    });

    public Task<bool> RenewAsync(TranslationLease lease, TimeSpan duration, CancellationToken ct) => WithDb(async db =>
    {
        var until = DateTime.UtcNow + duration;
        return await Held(db, lease).ExecuteUpdateAsync(s => s.SetProperty(q => q.LeaseUntilUtc, until), ct) > 0;
    });

    public Task ReleaseAsync(TranslationLease lease, bool uncount, CancellationToken ct) => WithDb(async db =>
    {
        var back = uncount ? 1 : 0;
        return await Held(db, lease).ExecuteUpdateAsync(s => s
            .SetProperty(q => q.LeaseUntilUtc, (DateTime?)null)
            .SetProperty(q => q.LeaseOwner, (Guid?)null)
            .SetProperty(q => q.Attempts, q => q.Attempts - back), ct);
    });

    public Task<bool> BeginAnswerAsync(TranslationLease lease, TimeSpan duration, CancellationToken ct) => WithDb(async db =>
    {
        var until = DateTime.UtcNow + duration;
        return await Held(db, lease).ExecuteUpdateAsync(s => s
            .SetProperty(q => q.State, QueuedTranslationState.Answering)
            .SetProperty(q => q.LeaseUntilUtc, until), ct) > 0;
    });

    public Task<bool> FinishAsync(
        TranslationLease lease, QueuedTranslationState state, string outcome, Guid? vocabularyEntryId, CancellationToken ct) =>
        WithDb(async db =>
        {
            var now = DateTime.UtcNow;
            return await Held(db, lease).ExecuteUpdateAsync(s => s
                .SetProperty(q => q.State, state)
                .SetProperty(q => q.Outcome, outcome)
                .SetProperty(q => q.VocabularyEntryId, vocabularyEntryId)
                .SetProperty(q => q.FinishedAtUtc, now)
                .SetProperty(q => q.LeaseUntilUtc, (DateTime?)null)
                .SetProperty(q => q.LeaseOwner, (Guid?)null), ct) > 0;
        });

    public Task MarkVerbLookupAsync(Guid id, CancellationToken ct) => WithDb(db =>
        db.QueuedTranslations.Where(q => q.Id == id).ExecuteUpdateAsync(s => s.SetProperty(q => q.VerbLookup, true), ct));

    public Task MarkNoticeSentAsync(Guid id, CancellationToken ct) => WithDb(db =>
        db.QueuedTranslations.Where(q => q.Id == id).ExecuteUpdateAsync(s => s.SetProperty(q => q.NoticeSent, true), ct));

    /// <summary>The record while this run still holds it: unfinished, same owner, same start.</summary>
    private static IQueryable<QueuedTranslation> Held(TraleDbContext db, TranslationLease lease) =>
        db.QueuedTranslations.Where(q => q.Id == lease.Id
                                         && q.LeaseOwner == lease.Owner
                                         && q.Attempts == lease.Attempt
                                         && (q.State == QueuedTranslationState.Pending || q.State == QueuedTranslationState.Answering));

    private async Task<T> WithDb<T>(Func<TraleDbContext, Task<T>> action)
    {
        await using var scope = scopes.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<TraleDbContext>());
    }
}
