using Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Application.Translation.Pipeline;

/// <summary>Who the current translation request is for — set by the caller, read by <see cref="ModelBudget"/>.</summary>
public class TranslationRequester
{
    /// <summary>Null when the request has no user (a background job): only the overall caps apply.</summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Called (possibly more than once) when the request goes on to the slow part: a verb that is not in
    /// the base is being looked up in the source or with the models. Set by a caller that wants to tell
    /// the person so (<see cref="TranslationJobs"/>); nobody listening is the normal case.
    /// </summary>
    public Action? VerbLookupStarted { get; set; }
}

public enum ModelSpend
{
    /// <summary>A request that reaches a model at all (the classifier and whatever follows).</summary>
    Request,

    /// <summary>A request that goes on to the strong model — a verb being written. Its own, lower cap.</summary>
    Generation
}

/// <summary>
/// The counters behind <see cref="ModelBudget"/>, in the database. Implemented in Persistence: raising
/// a counter is one conditional UPDATE, which needs the relational side of EF.
/// </summary>
public interface IModelBudgetCounter
{
    /// <summary>
    /// Raises the day's counter of a user (or of <see cref="ModelBudgetDay.Everyone"/>) by one unless it
    /// is at its cap; false when it is. Cap 0 = no limit (the request is still counted).
    /// </summary>
    Task<bool> TakeAsync(DateOnly day, Guid userId, ModelSpend kind, int cap, CancellationToken ct);
}

/// <summary>
/// The guard that lets the agent be switched on without fear of a bill: daily caps (UTC) on requests
/// that reach a model — overall and per user, and separate, lower ones for the strong model. The
/// counters are rows in the database (<see cref="ModelBudgetDay"/>), so they survive a restart and are
/// shared by every instance; each is raised by one conditional UPDATE, so two requests at once cannot
/// both take the last place. Over a cap — or when the counter cannot be reached — the request silently
/// takes the path without models.
/// Service per ARCHITECTURE.md.
/// </summary>
public class ModelBudget(
    IModelBudgetCounter counter,
    TranslationRequester requester,
    IOptions<TranslationAgentOptions> options,
    ILogger<ModelBudget> logger)
{
    /// <summary>Takes one request out of today's budget; false when a cap is reached.</summary>
    public async Task<bool> TrySpendAsync(ModelSpend kind, CancellationToken ct)
    {
        var o = options.Value;
        var (overallCap, userCap) = kind == ModelSpend.Generation
            ? (o.MaxGenerationsPerDay, o.MaxGenerationsPerUserPerDay)
            : (o.MaxModelRequestsPerDay, o.MaxModelRequestsPerUserPerDay);
        var day = DateOnly.FromDateTime(DateTime.UtcNow);
        try
        {
            // The user's own cap first: a user who is over it must not use up the common budget.
            if (requester.UserId is { } user && !await counter.TakeAsync(day, user, kind, userCap, ct))
            {
                logger.LogInformation("Translation agent: {Kind} cap of {Cap} a day reached for one user", kind, userCap);
                return false;
            }

            if (!await counter.TakeAsync(day, ModelBudgetDay.Everyone, kind, overallCap, ct))
            {
                logger.LogWarning("Translation agent: daily {Kind} cap of {Cap} reached; the rest of {Day} goes without it", kind, overallCap, day);
                return false;
            }

            return true;
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            // A budget that cannot be counted is a budget that cannot be kept: no model for this request.
            logger.LogWarning("Translation agent: budget counter failed ({Error}); the request goes without models", e.GetType().Name);
            return false;
        }
    }
}
