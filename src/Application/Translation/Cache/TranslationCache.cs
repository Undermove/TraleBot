using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Translation.Cache;

/// <summary>
/// Read/write side of the <c>TranslationCache</c> table: answers built from the verb base and the
/// models' verdicts about a text. Entries never expire; a wrong one is fixed by deleting the row.
/// Service per ARCHITECTURE.md.
/// </summary>
public class TranslationCache(ITraleDbContext dbContext)
{
    public const string SourceExternal = "external";
    public const string SourceVerbAgent = "verb-agent";

    /// <summary>A verdict without a translation: the classifier is sure the text is not something to translate.</summary>
    public const string SourceNotTranslatable = "not-translatable";

    /// <summary>
    /// A verdict without a translation: the models have had their say about the text (not a verb, or the
    /// verb proposal did not hold) and the plain translator had nothing — next time only the translator is asked.
    /// </summary>
    public const string SourceNoTranslation = "no-translation";

    /// <summary>Whether the entry carries a translation to serve, not just a remembered verdict.</summary>
    /// <remarks>
    /// Only an answer the models stand behind is served from here. What the dictionary site or Google
    /// said is asked from them again each time: rows with <see cref="SourceExternal"/> are from before
    /// that rule and count as a verdict only.
    /// </remarks>
    public static bool HasTranslation(TranslationCacheEntry entry) => entry.Source == SourceVerbAgent;

    /// <summary>Remembers what the models decided about a text that has no translation to cache.</summary>
    public Task StoreVerdictAsync(
        string key, TranslationDirection direction, string source, CancellationToken ct, TranslationCacheEntry? replace = null)
    {
        return StoreAsync(
            key, direction, new TranslationResult.Success(string.Empty, string.Empty, string.Empty), source, classified: true, ct, replace);
    }

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
