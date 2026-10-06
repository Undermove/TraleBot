namespace Application.Translation.Pipeline;

/// <summary>
/// Configuration section <c>TranslationAgent</c>. The agent path is off unless it is switched on here
/// AND an OpenAI key and both model ids are configured — see <see cref="ITranslationAgentSwitch"/>.
/// </summary>
public class TranslationAgentOptions
{
    public const string SectionName = "TranslationAgent";

    /// <summary>The master switch. Off: translation works as before, plus the cache.</summary>
    public bool Enabled { get; set; }

    /// <summary>Cheap small model: "is this a translation request, is it a verb".</summary>
    public string ClassifierModel { get; set; } = string.Empty;

    /// <summary>Stronger model that resolves a verb with the tools.</summary>
    public string AnalystModel { get; set; } = string.Empty;

    /// <summary>
    /// How much the model "thinks" before answering: none | low | medium | high; empty = the model's
    /// default. Less is faster and cheaper; what is enough is decided by <c>scripts/dev/eval-translation.py</c>.
    /// </summary>
    public string ClassifierReasoning { get; set; } = string.Empty;

    /// <inheritdoc cref="ClassifierReasoning"/>
    public string AnalystReasoning { get; set; } = string.Empty;

    /// <summary>
    /// Whether a verb with no conjugation table in the source may be stored with forms produced by the
    /// model (status Generated, shown as «не проверено»). Off: such a verb is just translated as before.
    /// </summary>
    public bool AllowGeneratedVerbs { get; set; } = true;

    /// <summary>
    /// The bill's ceiling: how many requests a day (UTC) may reach a model at all. Over it, requests take
    /// the path without models until the next day. 0 = no limit.
    /// </summary>
    public int MaxModelRequestsPerDay { get; set; } = 2000;

    // Timeouts come from scripts/dev/eval-translation.py on the chosen models (06.10.2026): the
    // classifier answered in 1.6 s at the median and 2.8 s at the 95th percentile, a whole analyst
    // request in 5.9 s / 16.6 s. A step that takes about twice its p95 is not coming back.
    public int ClassifierTimeoutSeconds { get; set; } = 5;

    /// <summary>The whole analysis run: every model turn and every tool call of it.</summary>
    public int AnalystTimeoutSeconds { get; set; } = 25;

    /// <summary>One HTTP attempt to Wiktionary.</summary>
    public int WiktionaryTimeoutSeconds { get; set; } = 8;

    /// <summary>Politeness: at most one request to Wiktionary per this interval, for the whole process.</summary>
    public int WiktionaryMinIntervalMs { get; set; } = 1000;

    /// <summary>Retries after a throttled or failed attempt; each waits one delay longer than the previous.</summary>
    public int WiktionaryRetries { get; set; } = 2;

    public int WiktionaryRetryDelayMs { get; set; } = 1500;
}
