using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

/// <summary>
/// When each person last did something that leaves a dated trace: answered in a lesson of the
/// mini-app, added a word (bot or mini-app), started a quiz or a verb session. There is no record
/// of merely opening the mini-app or the chat, so "active" means "studied". One definition for
/// the broadcast audiences, the users list and the overview numbers.
/// </summary>
public static class UserActivity
{
    public static async Task<Dictionary<Guid, DateTime>> LoadLastAsync(ITraleDbContext db, CancellationToken ct)
    {
        var traces = new[]
        {
            await db.MiniAppUserProgresses.AsNoTracking().Where(p => p.LastPlayedAtUtc != null)
                .GroupBy(p => p.UserId).Select(g => new { UserId = g.Key, At = g.Max(p => p.LastPlayedAtUtc)!.Value }).ToListAsync(ct),
            await db.VocabularyEntries.AsNoTracking()
                .GroupBy(v => v.UserId).Select(g => new { UserId = g.Key, At = g.Max(v => v.DateAddedUtc) }).ToListAsync(ct),
            await db.Quizzes.AsNoTracking()
                .GroupBy(q => q.UserId).Select(g => new { UserId = g.Key, At = g.Max(q => q.DateStarted) }).ToListAsync(ct),
            await db.VerbSessions.AsNoTracking()
                .GroupBy(s => s.UserId).Select(g => new { UserId = g.Key, At = g.Max(s => s.StartedAtUtc) }).ToListAsync(ct)
        };
        return traces.SelectMany(t => t).GroupBy(t => t.UserId).ToDictionary(g => g.Key, g => g.Max(t => t.At));
    }
}
