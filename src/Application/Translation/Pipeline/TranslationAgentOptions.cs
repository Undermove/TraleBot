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
    /// The strong model that writes the full record of a verb neither the base nor Wiktionary's tables
    /// have. Used for nothing else. Which tier is enough is decided by <c>scripts/dev/eval-translation.py</c>.
    /// </summary>
    public string GeneratorModel { get; set; } = "gpt-6-astra";

    /// <summary>The model that approves or rejects what the generator wrote. Must differ from <see cref="GeneratorModel"/>.</summary>
    public string ReviewerModel { get; set; } = "gpt-6-sol";

    /// <inheritdoc cref="ClassifierReasoning"/>
    public string GeneratorReasoning { get; set; } = string.Empty;

    /// <inheritdoc cref="ClassifierReasoning"/>
    public string ReviewerReasoning { get; set; } = string.Empty;

    /// <summary>
    /// Reasoning effort of the generator on the completion round — when a record came without some of
    /// the six main tenses and the generator is asked for exactly those. That is the hard case (a verb
    /// that does not follow the usual scheme), so it is set explicitly rather than left to the model's
    /// default. "high" did not fit: on 07.10.2026 three calls of five ran past 60 seconds; "medium"
    /// answered in 25–35.
    /// </summary>
    public string CompletionReasoning { get; set; } = "medium";

    /// <summary>
    /// Whether a record with a main tense missing is sent back to the generator once for those tenses
    /// before the reviewer sees it. Off: such a record is reviewed and stored as written.
    /// </summary>
    public bool CompleteMissingTenses { get; set; } = true;

    /// <summary>
    /// Whether a verb with no conjugation table in the source may be written by the generator and, once
    /// the reviewer approves it, stored (status Generated). Off: such a verb is just translated as before.
    /// </summary>
    public bool AllowGeneratedVerbs { get; set; } = true;

    /// <summary>
    /// The bill's ceiling: how many requests a day (UTC) may reach a model at all, all users together.
    /// Over it, requests take the path without models until the next day. 0 = no limit. The counters
    /// are in the database (<see cref="ModelBudget"/>): a restart does not reset them.
    /// </summary>
    public int MaxModelRequestsPerDay { get; set; } = 2000;

    /// <summary>The same ceiling for one user. 0 = no limit.</summary>
    public int MaxModelRequestsPerUserPerDay { get; set; } = 100;

    /// <summary>
    /// How many requests a day may go on to the strong model (a verb being written — the expensive
    /// part). 0 = no limit. One place in this budget covers everything one verb takes: the first record,
    /// the completion round and the repair round — at most three calls of the generator and two of the
    /// reviewer. Measured with the default models on 07.10.2026: about $0.06–0.07 a verb written in one
    /// pass, about $0.13 with a completion round or with a repair round, so the day's worst bill is
    /// about the cap times $0.20.
    /// </summary>
    public int MaxGenerationsPerDay { get; set; } = 100;

    /// <inheritdoc cref="MaxGenerationsPerDay"/>
    public int MaxGenerationsPerUserPerDay { get; set; } = 10;

    // Timeouts come from scripts/dev/eval-translation.py on the chosen models (06.10.2026): the
    // classifier answered in 1.6 s at the median and 2.8 s at the 95th percentile, a whole analyst
    // request in 5.9 s / 16.6 s. A step that takes about twice its p95 is not coming back.
    // 06.10.2026, later the same day, with the longer instructions: the classifier's p95 was 5.3 s and a
    // 5-second limit cut off real answers (a made-up verb then went to machine translation) — hence 10.
    public int ClassifierTimeoutSeconds { get; set; } = 10;

    /// <summary>The whole analysis run: every model turn and every tool call of it.</summary>
    public int AnalystTimeoutSeconds { get; set; } = 25;

    /// <summary>One call of the generator. A strong model writing forty forms takes its time.</summary>
    public int GeneratorTimeoutSeconds { get; set; } = 60;

    /// <summary>One call of the reviewer.</summary>
    public int ReviewerTimeoutSeconds { get; set; } = 30;

    /// <summary>The completion round: one call of the generator, for the missing tenses only, with more reasoning.</summary>
    public int CompletionTimeoutSeconds { get; set; } = 60;

    /// <summary>
    /// Everything <see cref="VerbGenerationService"/> does for one verb — the record, the completion
    /// round, the reviewer, the repair round and the second review — must fit in this; a step gets what
    /// is left of it. With the classifier and the analyst before it (10 s + 25 s) the whole request then
    /// stays under the three minutes the mini-app waits for an answer and far under the job's five.
    /// </summary>
    public int GenerationTotalSeconds { get; set; } = 140;

    /// <summary>One HTTP attempt to Wiktionary.</summary>
    public int WiktionaryTimeoutSeconds { get; set; } = 8;

    /// <summary>Politeness: at most one request to Wiktionary per this interval, for the whole process.</summary>
    public int WiktionaryMinIntervalMs { get; set; } = 1000;

    /// <summary>Retries after a throttled or failed attempt; each waits one delay longer than the previous.</summary>
    public int WiktionaryRetries { get; set; } = 2;

    public int WiktionaryRetryDelayMs { get; set; } = 1500;

    /// <summary>
    /// The bot: how long after the word was sent the person is told «ищу глагол…» if a verb is still
    /// being looked up. Answers that arrive sooner look as they always did. The classifier's 1.6 s and
    /// one Wiktionary page fit in it; an analyst run (5.9 s at the median) does not.
    /// </summary>
    public int SlowReplyNoticeMs { get; set; } = 4000;

    /// <summary>
    /// The mini-app: how long <c>POST /api/miniapp/translate</c> holds the request before answering
    /// <c>pending</c> (the mini-app then asks <c>translate/status</c>). Far below any proxy timeout.
    /// </summary>
    public int MiniAppTranslateWaitMs { get; set; } = 5000;

    // ── A translation that outlives its request (QueuedTranslation, TranslationJobs) ──────────────
    // From the moment the request stops waiting (the two delays above) the work is on record in the
    // database and a background job stands guard over it: if the instance doing it dies, the job
    // takes it over on any instance.

    /// <summary>
    /// How long the instance working on a translation is believed alive after its last sign of life.
    /// When it dies, another instance takes the work over after at most this long.
    /// </summary>
    public int JobLeaseMs { get; set; } = 45_000;

    /// <summary>How often the working instance gives that sign of life. Several times within <see cref="JobLeaseMs"/>.</summary>
    public int JobLeaseRenewMs { get; set; } = 10_000;

    /// <summary>How often the background job looks whether the work is done or has been left.</summary>
    public int JobPollMs { get; set; } = 2000;

    /// <summary>
    /// How many times a translation may be started in all. After the last one fails too, the bot says
    /// «Не успел найти перевод…» and the mini-app gets <c>failure</c> — nothing is tried again.
    /// A run stopped by a restart of the application does not count.
    /// </summary>
    public int JobMaxAttempts { get; set; } = 3;

    /// <summary>The pause before a failed run is tried again; each next one waits one pause longer.</summary>
    public int JobRetryDelayMs { get; set; } = 3000;
}
