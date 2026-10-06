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
    /// Whether a verb with no conjugation table in the source may be stored with forms produced by the
    /// model (status Generated, shown as «не проверено»). Off: such a verb is just translated as before.
    /// </summary>
    public bool AllowGeneratedVerbs { get; set; } = true;

    public int ClassifierTimeoutSeconds { get; set; } = 6;

    /// <summary>The whole analysis run: every model turn and every tool call of it.</summary>
    public int AnalystTimeoutSeconds { get; set; } = 30;

    /// <summary>One HTTP attempt to Wiktionary.</summary>
    public int WiktionaryTimeoutSeconds { get; set; } = 8;

    /// <summary>Politeness: at most one request to Wiktionary per this interval, for the whole process.</summary>
    public int WiktionaryMinIntervalMs { get; set; } = 1000;

    /// <summary>Retries after a throttled or failed attempt; each waits one delay longer than the previous.</summary>
    public int WiktionaryRetries { get; set; } = 2;

    public int WiktionaryRetryDelayMs { get; set; } = 1500;
}
