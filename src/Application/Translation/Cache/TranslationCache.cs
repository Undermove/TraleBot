using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Translation.Cache;

/// <summary>
/// Read/write side of the <c>TranslationCache</c> table. Entries never expire: a dictionary
/// translation does not go stale, and a wrong one is fixed by deleting the row.
/// Service per ARCHITECTURE.md.
/// </summary>
public class TranslationCache(ITraleDbContext dbContext)
{
    public const string SourceExternal = "external";
    public const string SourceVerbAgent = "verb-agent";

    public Task<TranslationCacheEntry?> FindAsync(string key, TranslationDirection direction, CancellationToken ct)
    {
        return dbContext.TranslationCache.FirstOrDefaultAsync(e => e.Key == key && e.Direction == direction, ct);
    }

    /// <summary>Counts a served hit. <paramref name="classified"/> can only raise the flag, never clear it.</summary>
    public async Task RecordHitAsync(TranslationCacheEntry entry, bool classified, CancellationToken ct)
    {
        entry.HitCount++;
        entry.LastHitAtUtc = DateTime.UtcNow;
        entry.Classified |= classified;
        await SaveAsync(entry, ct);
    }

    /// <param name="replace">An entry for the same text that the new answer supersedes.</param>
    public async Task StoreAsync(
        string key,
        TranslationDirection direction,
        TranslationResult.Success result,
        string source,
        bool classified,
        CancellationToken ct,
        TranslationCacheEntry? replace = null)
    {
        var entry = replace ?? new TranslationCacheEntry
        {
            Id = Guid.NewGuid(),
            Key = key,
            Direction = direction,
            Definition = string.Empty,
            AdditionalInfo = string.Empty,
            Example = string.Empty,
            Source = string.Empty,
            CreatedAtUtc = DateTime.UtcNow
        };
        entry.Definition = result.Definition;
        entry.AdditionalInfo = result.AdditionalInfo;
        entry.Example = result.Example;
        entry.Source = source;
        entry.Classified = classified;
        if (replace == null)
        {
            dbContext.TranslationCache.Add(entry);
        }

        await SaveAsync(entry, ct);
    }

    /// <summary>
    /// The cache is an optimisation: a failed write (two users looking up one new word at the same moment
    /// hit the unique index) must neither fail the translation nor leave a broken entity in the
    /// request's DbContext for the caller's own SaveChanges to trip over.
    /// </summary>
    private async Task SaveAsync(TranslationCacheEntry entry, CancellationToken ct)
    {
        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            dbContext.Entry(entry).State = EntityState.Detached;
        }
    }
}
