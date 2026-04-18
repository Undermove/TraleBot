using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Services;

public enum FeedTreatResult
{
    Success,
    NotEnoughXp,
    InvalidTreatIndex,
    UserNotFound
}

/// <summary>
/// Processes a treat purchase in the Bombora treat shop.
/// Deducts XP from the user's spendable balance and records the treat gift.
/// </summary>
public class FeedTreatService(ITraleDbContext dbContext)
{
    /// <summary>
    /// XP prices for each treat level (0=Dzval, 1=Khorci, 2=Mtsvadi, 3=Churchkhela, 4=Supra).
    /// </summary>
    public static readonly int[] TreatPrices = [10, 30, 60, 100, 200];

    public async Task<FeedTreatResponse> ExecuteAsync(Guid userId, int treatIndex, CancellationToken ct)
    {
        if (treatIndex < 0 || treatIndex >= TreatPrices.Length)
        {
            return new FeedTreatResponse(FeedTreatResult.InvalidTreatIndex, 0, 0);
        }

        var userExists = await dbContext.Users.AnyAsync(u => u.Id == userId, ct);
        if (!userExists)
        {
            return new FeedTreatResponse(FeedTreatResult.UserNotFound, 0, 0);
        }

        var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, userId, ct);

        var price = TreatPrices[treatIndex];
        var availableXp = progress.Xp - progress.XpSpent;

        if (availableXp < price)
        {
            return new FeedTreatResponse(FeedTreatResult.NotEnoughXp, progress.XpSpent, progress.TotalTreatsGiven);
        }

        var now = DateTime.UtcNow;
        progress.XpSpent += price;
        progress.TotalTreatsGiven += 1;
        progress.LastFedAtUtc = now;
        progress.LastTreatIndex = treatIndex;
        progress.UpdatedAtUtc = now;

        await dbContext.SaveChangesAsync(ct);

        return new FeedTreatResponse(FeedTreatResult.Success, progress.XpSpent, progress.TotalTreatsGiven, progress.LastFedAtUtc, progress.LastTreatIndex);
    }
}

public record FeedTreatResponse(FeedTreatResult Result, int XpSpent, int TotalTreatsGiven, DateTime? LastFedAtUtc = null, int? LastTreatIndex = null);
