using Application.Translation.Pipeline;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Persistence;

/// <summary>
/// <see cref="IModelBudgetCounter"/> over <see cref="ModelBudgetDay"/> rows: one row per UTC day and
/// user, raised by a conditional UPDATE so that two requests at once cannot both take the last place.
/// </summary>
public class ModelBudgetCounter(TraleDbContext dbContext, ILogger<ModelBudgetCounter> logger) : IModelBudgetCounter
{
    /// <summary>Counter rows older than this are removed when a new day starts.</summary>
    private const int KeepDays = 30;

    /// <summary>Raises one counter by one unless it is at its cap. Cap 0 = no limit (the request is still counted).</summary>
    public async Task<bool> TakeAsync(DateOnly day, Guid userId, ModelSpend kind, int cap, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var row = dbContext.ModelBudgetDays.Where(b => b.Day == day && b.UserId == userId);
            var taken = kind == ModelSpend.Generation
                ? await row.Where(b => cap <= 0 || b.Generations < cap)
                    .ExecuteUpdateAsync(s => s.SetProperty(b => b.Generations, b => b.Generations + 1), ct)
                : await row.Where(b => cap <= 0 || b.Requests < cap)
                    .ExecuteUpdateAsync(s => s.SetProperty(b => b.Requests, b => b.Requests + 1), ct);
            if (taken > 0)
            {
                return true;
            }

            if (attempt > 0 || await row.AnyAsync(ct))
            {
                return false;
            }

            await CreateRowAsync(day, userId, ct);
        }

        return false;
    }

    private async Task CreateRowAsync(DateOnly day, Guid userId, CancellationToken ct)
    {
        var created = new ModelBudgetDay { Id = Guid.NewGuid(), Day = day, UserId = userId };
        dbContext.ModelBudgetDays.Add(created);
        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Another request created today's row at the same moment; nothing of ours may stay in the
            // request's DbContext for the caller's own SaveChanges.
            dbContext.Entry(created).State = EntityState.Detached;
            return;
        }

        if (userId == ModelBudgetDay.Everyone)
        {
            // A new day: yesterday's total goes to the log, old rows go away.
            var before = day.AddDays(-KeepDays);
            var yesterday = await dbContext.ModelBudgetDays.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Day == day.AddDays(-1) && b.UserId == ModelBudgetDay.Everyone, ct);
            if (yesterday != null)
            {
                logger.LogInformation(
                    "Translation agent: {Requests} requests reached a model on {Day}, {Generations} of them wrote a verb",
                    yesterday.Requests, yesterday.Day, yesterday.Generations);
            }

            await dbContext.ModelBudgetDays.Where(b => b.Day < before).ExecuteDeleteAsync(ct);
        }
    }
}
