using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp;

public static class MiniAppHelpers
{
    public static async Task<MiniAppUserProgress> LoadOrCreateProgressAsync(
        ITraleDbContext dbContext, Guid userId, CancellationToken ct)
    {
        var progress = await dbContext.MiniAppUserProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (progress != null)
        {
            return progress;
        }

        var now = DateTime.UtcNow;
        progress = new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Xp = 0,
            Streak = 0,
            Hearts = 0,
            MaxHearts = 0,
            CompletedLessonsJson = "{}",
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        dbContext.MiniAppUserProgresses.Add(progress);
        return progress;
    }

    public static bool ContainsGeorgian(string s)
    {
        if (string.IsNullOrEmpty(s)) return false;
        foreach (var c in s)
        {
            if (c >= 0x10A0 && c <= 0x10FF) return true;
        }
        return false;
    }

    /// <summary>
    /// Returns (georgian, russian) sides of a vocabulary entry regardless of
    /// which column holds which language.
    /// </summary>
    public static (string georgian, string russian) GetSides(VocabularyEntry e)
    {
        if (ContainsGeorgian(e.Word))
        {
            return (e.Word, e.Definition);
        }
        return (e.Definition, e.Word);
    }
}
