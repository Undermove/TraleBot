using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Application.Translation.Pipeline;

/// <summary>
/// The guard that lets the agent be switched on without fear of a bill: a daily cap on requests that
/// reach a model. One instance per process; the count is in memory, so a restart starts the day anew —
/// good enough for a ceiling, and it cannot fail a request the way a database counter could.
/// </summary>
public class ModelBudget(IOptions<TranslationAgentOptions> options, ILogger<ModelBudget> logger)
{
    private readonly object _lock = new();
    private DateOnly _day = DateOnly.FromDateTime(DateTime.UtcNow);
    private int _spent;
    private bool _capLogged;

    /// <summary>Takes one request out of today's budget; false when there is none left.</summary>
    public bool TrySpend()
    {
        var cap = options.Value.MaxModelRequestsPerDay;
        lock (_lock)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (today != _day)
            {
                logger.LogInformation("Translation agent: {Count} requests reached a model on {Day}", _spent, _day);
                (_day, _spent, _capLogged) = (today, 0, false);
            }

            if (cap > 0 && _spent >= cap)
            {
                if (!_capLogged)
                {
                    logger.LogWarning("Translation agent: daily cap of {Cap} model requests reached; the rest of {Day} goes without models", cap, _day);
                    _capLogged = true;
                }

                return false;
            }

            _spent++;
            return true;
        }
    }
}
