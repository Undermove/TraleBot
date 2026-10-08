using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Admin;
using Application.Common;
using Application.Common.Interfaces;
using Application.Notifications;
using Application.Notifications.Holidays;
using Infrastructure.Telegram;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Trale.Services;

namespace Trale.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : Controller
{
    private const string InitDataHeader = "X-Telegram-Init-Data";

    // Hardcoded owner Telegram ID for now (matches GetMiniAppProfile.cs).
    // BotConfiguration.OwnerTelegramId can override via env BOTCONFIGURATION__OWNERTELEGRAMID.
    private const long DefaultOwnerTelegramId = 309149393;

    private readonly ITraleDbContext _dbContext;
    private readonly BotConfiguration _botConfig;
    private readonly GetAdminStatsQuery _statsQuery;
    private readonly GetUserSignupsTimeseriesQuery _timeseriesQuery;
    private readonly GetRecentUsersQuery _recentUsersQuery;
    private readonly GetUserDetailQuery _userDetailQuery;
    private readonly GrantProService _grantPro;
    private readonly RevokeProService _revokePro;
    private readonly BroadcastService _broadcast;
    private readonly IUserNotificationService _notifications;
    private readonly IHolidayCalendarService _holidayCalendar;

    public AdminController(
        ITraleDbContext dbContext,
        BotConfiguration botConfig,
        GetAdminStatsQuery statsQuery,
        GetUserSignupsTimeseriesQuery timeseriesQuery,
        GetRecentUsersQuery recentUsersQuery,
        GetUserDetailQuery userDetailQuery,
        GrantProService grantPro,
        RevokeProService revokePro,
        BroadcastService broadcast,
        IUserNotificationService notifications,
        IHolidayCalendarService holidayCalendar)
    {
        _dbContext = dbContext;
        _botConfig = botConfig;
        _statsQuery = statsQuery;
        _timeseriesQuery = timeseriesQuery;
        _recentUsersQuery = recentUsersQuery;
        _userDetailQuery = userDetailQuery;
        _grantPro = grantPro;
        _revokePro = revokePro;
        _broadcast = broadcast;
        _notifications = notifications;
        _holidayCalendar = holidayCalendar;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct))
        {
            return NotFound(); // hide existence from non-owners
        }

        var stats = await _statsQuery.ExecuteAsync(ct);
        return Ok(stats);
    }

    [HttpGet("signups")]
    public async Task<IActionResult> Signups([FromQuery] int days = 30, CancellationToken ct = default)
    {
        if (!await IsOwnerAsync(ct))
        {
            return NotFound();
        }

        var points = await _timeseriesQuery.ExecuteAsync(days, ct);
        return Ok(new { days, points });
    }

    [HttpGet("recent-users")]
    public async Task<IActionResult> RecentUsers(
        [FromQuery] int limit = 20,
        [FromQuery] string? search = null,
        [FromQuery] string sort = "recent_signup",
        CancellationToken ct = default)
    {
        if (!await IsOwnerAsync(ct))
        {
            return NotFound();
        }

        var sortEnum = sort switch
        {
            "recent_activity" => RecentUsersSort.RecentActivity,
            "vocab_count" => RecentUsersSort.VocabularyCount,
            _ => RecentUsersSort.RecentSignup
        };

        var users = await _recentUsersQuery.ExecuteAsync(limit, search, sortEnum, ct);
        return Ok(new { users });
    }

    [HttpGet("users/{telegramId:long}")]
    public async Task<IActionResult> UserDetail(long telegramId, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var detail = await _userDetailQuery.ExecuteAsync(telegramId, ct);
        if (detail == null) return NotFound();
        return Ok(detail);
    }

    /// <summary>
    /// Verbs a model wrote and a model approved, with what the approval rested on — the list a human
    /// revision works from. <c>?unrevised=true</c> leaves out the ones already looked over.
    /// </summary>
    [HttpGet("verbs/model-made")]
    public async Task<IActionResult> ModelMadeVerbs(
        [FromServices] Application.Verbs.ModelMadeVerbsQuery query, [FromQuery] bool unrevised = false,
        [FromQuery] bool unverified = false, CancellationToken ct = default)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var verbs = await query.ExecuteAsync(unrevised, ct, onlyUnverified: unverified);
        return Ok(new { count = verbs.Count, verbs });
    }

    /// <summary>
    /// The durable job queue at a glance: how many background jobs wait, run and have failed, how many
    /// instances serve the queue, and the translations that outlived their request. Read-only.
    /// </summary>
    [HttpGet("jobs")]
    public async Task<IActionResult> Jobs(
        [FromServices] Infrastructure.BackgroundJobs.JobQueueMonitor monitor, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var queue = monitor.Read();
        var since = DateTime.UtcNow.AddDays(-1);
        var translations = await _dbContext.QueuedTranslations
            .Where(q => q.CreatedAtUtc >= since)
            .GroupBy(q => q.State)
            .Select(g => new { State = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        int Count(params Domain.Entities.QueuedTranslationState[] states) =>
            translations.Where(t => states.Contains(t.State)).Sum(t => t.Count);

        return Ok(new
        {
            queue = new
            {
                enqueued = queue.Enqueued,
                scheduled = queue.Scheduled,
                processing = queue.Processing,
                succeeded = queue.Succeeded,
                failed = queue.Failed,
                servers = queue.Servers
            },
            translationsLast24h = new
            {
                pending = Count(Domain.Entities.QueuedTranslationState.Pending, Domain.Entities.QueuedTranslationState.Answering),
                done = Count(Domain.Entities.QueuedTranslationState.Done),
                failed = Count(Domain.Entities.QueuedTranslationState.Failed)
            }
        });
    }

    public class GenerateVerbPreviewRequest
    {
        /// <summary>The text as a learner would type it: a Russian verb form or a Georgian one.</summary>
        public string Text { get; set; } = string.Empty;

        /// <summary>For a Russian text — its infinitive (what the classifier would have named).</summary>
        public string? Infinitive { get; set; }

        public string? LemmaHint { get; set; }
    }

    /// <summary>
    /// Runs the generator and the reviewer on one verb and returns what they produced — the record, the
    /// evidence, the verdict with its reasons and the tokens of each role. Nothing is stored and the base
    /// is not consulted, so a verb that has a table can be generated "blind" and compared with the table.
    /// For <c>scripts/dev/eval-translation.py</c> (comparison of generator models).
    /// </summary>
    [HttpPost("verbs/generate-preview")]
    public async Task<IActionResult> GenerateVerbPreview(
        [FromBody] GenerateVerbPreviewRequest request,
        [FromServices] Application.Translation.Pipeline.VerbGenerationService generation,
        [FromServices] Application.Translation.Pipeline.IVerbGenerationSwitch generationSwitch,
        [FromServices] Application.Verbs.IVerbLexicon lexicon,
        CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var key = Application.Translation.Cache.TranslationCacheKey.Normalize(request.Text);
        if (key == null) return BadRequest(new { error = "invalid_text" });
        if (!generationSwitch.IsOn) return Conflict(new { error = "generation_is_off" });

        var isRussian = !Application.Verbs.VerbParadigm.GeorgianWord.IsMatch(key.Split(' ')[^1]);
        var infinitive = isRussian ? Application.Translation.Cache.TranslationCacheKey.Normalize(request.Infinitive) ?? key : null;
        var candidates = isRussian ? lexicon.FindByRussian(infinitive!) : lexicon.Find(key);
        var started = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var outcome = await generation.GenerateAsync(
                new Application.Translation.Pipeline.VerbGenerationRequest(key, isRussian, infinitive, request.LemmaHint, candidates),
                ct, preview: true);
            var draft = outcome.Draft;
            return Ok(new
            {
                outcome = outcome.Outcome,
                reason = outcome.Reason,
                repairRounds = outcome.RepairRounds,
                completionRounds = outcome.CompletionRounds,
                droppedRows = outcome.DroppedRows,
                completedTenses = draft?.Completed,
                missingTenses = draft?.Missing,
                seconds = started.Elapsed.TotalSeconds,
                generator = new { outcome.Generator.Calls, outcome.Generator.InputTokens, outcome.Generator.OutputTokens },
                reviewer = new { outcome.Reviewer.Calls, outcome.Reviewer.InputTokens, outcome.Reviewer.OutputTokens },
                lemma = draft?.Paradigm.Lemma,
                masdar = draft?.Paradigm.Masdar.FirstOrDefault(),
                russian = draft?.Russian,
                tenses = draft?.Paradigm.Tenses,
                meanings = draft?.Meanings.Meanings,
                approved = draft?.Review.Approved,
                reasons = draft?.Review.Reasons,
                formsTotal = draft?.Evidence.FormsTotal,
                formsAttested = draft?.Evidence.FormsAttested,
                unattested = draft?.Evidence.Unattested,
                lemmaInLexicon = draft?.Evidence.LexiconEntry != null
            });
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            // The kind of failure only: a provider's message can quote the request and credentials.
            var error = Application.Translation.Pipeline.GeorgianTranslationPipeline.Describe(e);
            return Ok(new { outcome = "failed", reason = error, seconds = started.Elapsed.TotalSeconds });
        }
    }

    public class RegenerateVerbRequest
    {
        /// <summary>Lemma of a model-made verb, as <c>verbs/model-made</c> lists it.</summary>
        public string Lemma { get; set; } = string.Empty;

        /// <summary>The owner's explicit word for a verb they approved as a whole: rebuild it anyway.</summary>
        public bool EvenIfApproved { get; set; }
    }

    /// <summary>
    /// «Пересобрать глагол»: writes a model-made verb again with today's generator (completion round
    /// included) and replaces the stored record only when the new one is approved, is the same verb and
    /// has at least as many main tenses. Curated verbs and verbs from a source table are refused. The
    /// verb's row stays, so learners keep their progress. Takes up to a couple of minutes; the work does
    /// not stop if the caller's connection does — the list shows the result.
    /// </summary>
    [HttpPost("verbs/regenerate")]
    public async Task<IActionResult> RegenerateVerb(
        [FromBody] RegenerateVerbRequest request,
        [FromServices] Application.Translation.Pipeline.VerbRegenerationService regeneration,
        CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var lemma = (request.Lemma ?? string.Empty).Trim();
        if (!Application.Verbs.VerbParadigm.GeorgianWord.IsMatch(lemma)) return BadRequest(new { error = "invalid_lemma" });

        // Not the request's token: a proxy closes a long request, and a half-done rebuild helps nobody.
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(4));
        var result = await regeneration.ExecuteAsync(lemma, timeout.Token, request.EvenIfApproved);
        return result.Outcome switch
        {
            "not-found" => NotFound(new { error = "verb_not_found" }),
            "not-model-made" => Conflict(new { error = "not_model_made" }),
            "generation-is-off" => Conflict(new { error = "generation_is_off" }),
            "approved-by-owner" => Conflict(new { error = "approved_by_owner" }),
            "over-budget" => StatusCode(429, new { error = "over_generation_budget" }),
            _ => Ok(result)
        };
    }

    public class ReviewVerbTenseRequest
    {
        public string Lemma { get; set; } = string.Empty;

        /// <summary>Tense key as in the verb card: future, aorist, …</summary>
        public string Tense { get; set; } = string.Empty;

        /// <summary>For <c>edit</c>: six cells in person order; null or empty — the cell stays empty.</summary>
        public List<string?>? Cells { get; set; }
    }

    /// <summary>
    /// The owner's review of one tense of a model-made verb: <c>confirm</c> (the row becomes verified and
    /// enters games), <c>edit</c> (the cells are written by hand — verified too) or <c>remove</c> (the row
    /// is deleted; a later rebuild can bring it back only as unverified). Recorded in the verb's
    /// provenance with who, when and the row before and after. Curated verbs are refused.
    /// </summary>
    [HttpPost("verbs/tense/confirm")]
    public async Task<IActionResult> ConfirmVerbTense(
        [FromBody] ReviewVerbTenseRequest request, [FromServices] Application.Verbs.VerbTenseReviewService review, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        return TenseReviewed(await review.ConfirmAsync(Trimmed(request.Lemma), Trimmed(request.Tense), OwnerTelegramId, ct));
    }

    /// <inheritdoc cref="ConfirmVerbTense"/>
    [HttpPost("verbs/tense/edit")]
    public async Task<IActionResult> EditVerbTense(
        [FromBody] ReviewVerbTenseRequest request, [FromServices] Application.Verbs.VerbTenseReviewService review, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        return TenseReviewed(await review.EditAsync(Trimmed(request.Lemma), Trimmed(request.Tense), request.Cells, OwnerTelegramId, ct));
    }

    /// <inheritdoc cref="ConfirmVerbTense"/>
    [HttpPost("verbs/tense/remove")]
    public async Task<IActionResult> RemoveVerbTense(
        [FromBody] ReviewVerbTenseRequest request, [FromServices] Application.Verbs.VerbTenseReviewService review, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        return TenseReviewed(await review.RemoveAsync(Trimmed(request.Lemma), Trimmed(request.Tense), OwnerTelegramId, ct));
    }

    public class ApproveVerbRequest
    {
        public string Lemma { get; set; } = string.Empty;

        /// <summary>Confirm the tenses that are still unverified along with the verb.</summary>
        public bool ConfirmAll { get; set; }
    }

    /// <summary>
    /// «Глагол проверен»: the owner approves a model-made verb as a whole. For learners it becomes a
    /// verified verb — the "made by a model" marks go, every tense is in games; who and when is kept in
    /// the provenance. With unverified tenses left it is refused (409 <c>has_unverified_tenses</c>) unless
    /// <c>confirmAll</c> is set. A rebuild of such a verb needs <c>evenIfApproved</c>.
    /// </summary>
    [HttpPost("verbs/approve")]
    public async Task<IActionResult> ApproveVerb(
        [FromBody] ApproveVerbRequest request, [FromServices] Application.Verbs.VerbTenseReviewService review, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var result = await review.ApproveVerbAsync(Trimmed(request.Lemma), request.ConfirmAll, OwnerTelegramId, ct);
        return result.Outcome == "has-unverified-tenses" ? Conflict(new { error = "has_unverified_tenses" }) : TenseReviewed(result);
    }

    /// <summary>«Снять отметку»: the verb is a model-made one to be looked over again; its tenses stay as they are.</summary>
    [HttpPost("verbs/unapprove")]
    public async Task<IActionResult> UnapproveVerb(
        [FromBody] ApproveVerbRequest request, [FromServices] Application.Verbs.VerbTenseReviewService review, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        return TenseReviewed(await review.UnapproveVerbAsync(Trimmed(request.Lemma), OwnerTelegramId, ct));
    }

    private static string Trimmed(string? value) => (value ?? string.Empty).Trim();

    private IActionResult TenseReviewed(Application.Verbs.TenseReviewResult result) => result.Outcome switch
    {
        "done" => Ok(new { ok = true, progressReset = result.ProgressReset }),
        "not-found" => NotFound(new { error = "verb_not_found" }),
        "not-model-made" => Conflict(new { error = "not_model_made" }),
        "no-such-tense" => NotFound(new { error = "no_such_tense" }),
        "present-stays" => BadRequest(new { error = "present_stays", problem = "the present cannot be removed and its he/she cell is the lemma" }),
        _ => BadRequest(new { error = "invalid_cells", problem = result.Problem })
    };

    public class WarmUpVerbRequest
    {
        /// <summary>A Russian infinitive (or a Georgian form) — as a learner would type it.</summary>
        public string Text { get; set; } = string.Empty;
    }

    /// <summary>
    /// Puts one verb through the translation pipeline exactly as a learner's request would — base,
    /// Wiktionary table, generation with approval — without a learner and without a dictionary entry,
    /// and tells what the base has for the text afterwards. For <c>scripts/verbs/warm-up.py</c>.
    /// The overall daily caps apply.
    /// </summary>
    [HttpPost("verbs/warm-up")]
    public async Task<IActionResult> WarmUpVerb(
        [FromBody] WarmUpVerbRequest request,
        [FromServices] Application.Translation.ILanguageTranslator translator,
        [FromServices] Application.Verbs.VerbBaseSearch verbBase,
        [FromServices] Application.Verbs.ModelMadeVerbsQuery modelMade,
        CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var key = Application.Translation.Cache.TranslationCacheKey.Normalize(request.Text);
        if (key == null) return BadRequest(new { error = "invalid_text" });

        object Verb(Application.Verbs.VerbBaseMatch match) => new
        {
            lemma = match.Lemma, title = match.Title, translation = match.Translation,
            status = Application.Verbs.RuntimeVerbStore.StatusName(match.Status)
        };

        var known = await verbBase.FindExactAsync(key, ct);
        if (known != null)
        {
            return Ok(new { outcome = "already-there", verb = Verb(known) });
        }

        var result = await translator.Translate(key, Domain.Entities.Language.Georgian, ct);
        var stored = await verbBase.FindExactAsync(key, ct);
        var provenance = stored == null
            ? null
            : (await modelMade.ExecuteAsync(onlyUnrevised: false, ct)).FirstOrDefault(v => v.Lemma == stored.Lemma);
        return Ok(new
        {
            outcome = stored != null ? "stored" : result is Application.Common.Interfaces.TranslationService.TranslationResult.Success ? "translated-only" : "nothing",
            definition = (result as Application.Common.Interfaces.TranslationService.TranslationResult.Success)?.Definition,
            verb = stored == null ? null : Verb(stored),
            provenance
        });
    }

    public class GrantProRequest
    {
        public string Plan { get; set; } = string.Empty;
    }

    [HttpPost("users/{telegramId:long}/grant-pro")]
    public async Task<IActionResult> GrantPro(long telegramId, [FromBody] GrantProRequest req, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var result = await _grantPro.ExecuteAsync(telegramId, req.Plan, ct);
        return result switch
        {
            GrantProResult.Success => Ok(new { ok = true }),
            GrantProResult.UserNotFound => NotFound(new { error = "user_not_found" }),
            GrantProResult.InvalidPlan => BadRequest(new { error = "invalid_plan" }),
            _ => StatusCode(500)
        };
    }

    [HttpPost("users/{telegramId:long}/revoke-pro")]
    public async Task<IActionResult> RevokePro(long telegramId, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var ok = await _revokePro.ExecuteAsync(telegramId, ct);
        return ok ? Ok(new { ok = true }) : NotFound(new { error = "user_not_found" });
    }

    public class TestReturnPushRequest
    {
        public string? ModuleName { get; set; }
        public string? ModuleId { get; set; }
        public int? LessonId { get; set; }
        public string? Variant { get; set; }
    }

    /// <summary>
    /// Fires the real D1+ return push (the same code ReturnPushWorker sends daily)
    /// to the owner's own Telegram, so the copy + deep-link button can be tested
    /// on demand without waiting for the 10:00 UTC schedule. Owner-only.
    /// </summary>
    [HttpPost("notifications/test-return-push")]
    public async Task<IActionResult> TestReturnPush([FromBody] TestReturnPushRequest? req, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerId, ct);
        if (owner == null) return NotFound(new { error = "owner_user_not_found" });

        // Honour the opt-out, exactly like the daily dispatch would: a user who
        // turned notifications off in Profile gets skipped (no push sent).
        if (!owner.NotificationsEnabled)
            return Ok(new { ok = false, reason = "notifications_disabled" });

        // Real spendable XP (Xp − XpSpent), so the "feed" copy shows your actual balance.
        var progress = await _dbContext.MiniAppUserProgresses
            .FirstOrDefaultAsync(p => p.UserId == owner.Id, ct);
        var availableXp = progress != null ? Math.Max(0, progress.Xp - progress.XpSpent) : 0;

        var allowed = new[] { "miss", "module", "feed", "earn" };
        var variant = allowed.Contains(req?.Variant) ? req!.Variant! : "feed";
        var moduleName = string.IsNullOrWhiteSpace(req?.ModuleName) ? "Падежи" : req!.ModuleName!.Trim();
        var moduleId = string.IsNullOrWhiteSpace(req?.ModuleId) ? "cases" : req!.ModuleId!.Trim();
        var lessonId = req?.LessonId is int l && l > 0 ? l : 1;

        await _notifications.SendDailyReturnPushAsync(owner, moduleName, moduleId, lessonId, variant, availableXp, ct);
        return Ok(new { ok = true, sentTo = ownerId, variant, availableXp, moduleName, moduleId, lessonId });
    }

    /// <summary>
    /// Fires the §82 Holiday push to the owner's own Telegram for EVERY holiday in the
    /// catalog (9 fixed + Easter), bypassing the worker's morning window + 24h cooldown,
    /// so the real copy of each one can be reviewed on demand. A small delay between
    /// sends keeps Telegram from 429-ing the single chat. Owner-only.
    /// </summary>
    [HttpPost("notifications/test-holiday-push")]
    public async Task<IActionResult> TestHolidayPush(CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerId, ct);
        if (owner == null) return NotFound(new { error = "owner_user_not_found" });
        if (!owner.NotificationsEnabled)
            return Ok(new { ok = false, reason = "notifications_disabled" });

        var holidays = _holidayCalendar.AllHolidays();
        var sent = new List<string>(holidays.Count);
        foreach (var holiday in holidays)
        {
            await _notifications.SendHolidayPushAsync(owner, holiday, ct);
            sent.Add(holiday.Key);
            await Task.Delay(400, ct);
        }

        return Ok(new { ok = true, sentTo = ownerId, count = sent.Count, holidays = sent });
    }

    /// <summary>
    /// Fires the §82 Coins-stale push to the owner, bypassing the 7-day cooldown +
    /// "no feeding in 7d" gate. Uses the owner's real spendable XP. Owner-only.
    /// </summary>
    [HttpPost("notifications/test-coins-push")]
    public async Task<IActionResult> TestCoinsPush(CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerId, ct);
        if (owner == null) return NotFound(new { error = "owner_user_not_found" });
        if (!owner.NotificationsEnabled)
            return Ok(new { ok = false, reason = "notifications_disabled" });

        var progress = await _dbContext.MiniAppUserProgresses
            .FirstOrDefaultAsync(p => p.UserId == owner.Id, ct);
        var availableXp = progress != null ? Math.Max(0, progress.Xp - progress.XpSpent) : 0;

        await _notifications.SendCoinsStalePushAsync(owner, availableXp, ct);
        return Ok(new { ok = true, sentTo = ownerId, availableXp });
    }

    public class TestStreakPushRequest
    {
        public int? Milestone { get; set; }
    }

    /// <summary>
    /// Fires the §82 Streak-milestone push to the owner, bypassing the milestone +
    /// 7-day cooldown gate. Milestone defaults to 7 (allowed: 7/30/100). Owner-only.
    /// </summary>
    [HttpPost("notifications/test-streak-push")]
    public async Task<IActionResult> TestStreakPush([FromBody] TestStreakPushRequest? req, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerId, ct);
        if (owner == null) return NotFound(new { error = "owner_user_not_found" });
        if (!owner.NotificationsEnabled)
            return Ok(new { ok = false, reason = "notifications_disabled" });

        var allowed = new[] { 7, 30, 100 };
        var milestone = req?.Milestone is int m && allowed.Contains(m) ? m : 7;

        await _notifications.SendStreakMilestonePushAsync(owner, milestone, ct);
        return Ok(new { ok = true, sentTo = ownerId, milestone });
    }

    [HttpGet("broadcast/preview")]
    public async Task<IActionResult> BroadcastPreview(
        [FromQuery] int? activeWithinDays,
        [FromQuery] int minVocab = 0,
        [FromQuery] DateTime? registeredAfterUtc = null,
        [FromQuery] DateTime? registeredBeforeUtc = null,
        [FromQuery] string? proStatus = null,
        CancellationToken ct = default)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var segment = new BroadcastSegment
        {
            ActiveWithinDays = activeWithinDays,
            MinVocabularyCount = minVocab,
            RegisteredAfterUtc = registeredAfterUtc,
            RegisteredBeforeUtc = registeredBeforeUtc,
            ProStatus = ParseProStatus(proStatus)
        };
        var preview = await _broadcast.PreviewAsync(segment, ct);
        return Ok(preview);
    }

    public class BroadcastRequest
    {
        public int? ActiveWithinDays { get; set; }
        public int MinVocabularyCount { get; set; }
        public DateTime? RegisteredAfterUtc { get; set; }
        public DateTime? RegisteredBeforeUtc { get; set; }
        public string? ProStatus { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? GrantPlan { get; set; }
        public bool DryRun { get; set; } = true;
        public bool IncludeMiniAppButton { get; set; } = true;
    }

    [HttpPost("broadcast")]
    public async Task<IActionResult> Broadcast([FromBody] BroadcastRequest req, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var segment = new BroadcastSegment
        {
            ActiveWithinDays = req.ActiveWithinDays,
            MinVocabularyCount = req.MinVocabularyCount,
            RegisteredAfterUtc = req.RegisteredAfterUtc,
            RegisteredBeforeUtc = req.RegisteredBeforeUtc,
            ProStatus = ParseProStatus(req.ProStatus)
        };
        var result = await _broadcast.ExecuteAsync(
            segment, req.Message, req.GrantPlan, req.DryRun, req.IncludeMiniAppButton, ct);
        if (result.Error != null) return BadRequest(result);
        return Ok(result);
    }

    // ---- Campaigns: a broadcast in parts (test sample → the rest), recorded per recipient. ----
    // Nothing is sent by picking recipients; sending is the separate, explicit "send" call.

    private long OwnerTelegramId => _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;

    [HttpGet("campaigns/audiences")]
    public async Task<IActionResult> CampaignAudiences(
        [FromServices] BroadcastCampaignService campaigns, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var counts = await campaigns.CountAudiencesAsync(OwnerTelegramId, ct);
        return Ok(counts.ToDictionary(c => AudienceName(c.Key), c => c.Value));
    }

    public class CampaignPrepareRequest
    {
        public string Key { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? ButtonText { get; set; }
        public string? ButtonQuery { get; set; }
        /// <summary>Random test group of this size; null — everyone in the audience not picked yet.</summary>
        public int? SampleSize { get; set; }
        public bool DryRun { get; set; } = true;
        /// <summary>Days of access given to a recipient who opens the button; 0 — no gift.</summary>
        public int GiftDays { get; set; }
        /// <summary>For how many days after the campaign is created the gift can still be taken; null — 14.</summary>
        public int? GiftOfferDays { get; set; }
        /// <summary>A survey: the form of questions (the first goes under the message as buttons, the rest are
        /// answered in the mini-app); null — an ordinary campaign. The message is made from the form.</summary>
        public Domain.Entities.SurveyForm? Survey { get; set; }
        /// <summary>The survey builder starting a new survey: with an empty <see cref="Key"/> the server names the
        /// campaign itself — <c>survey-2026-10-&lt;slug&gt;</c>, with a number when taken — and returns the key.</summary>
        public string? NewSurveySlug { get; set; }
    }

    /// <summary>Ready-made surveys for the survey builder and the answer buttons it offers by one tap.</summary>
    [HttpGet("surveys/presets")]
    public async Task<IActionResult> SurveyPresetList(CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        return Ok(new
        {
            presets = Application.Feedback.SurveyPresets.All.Select(p => new { p.Id, p.Title, p.About, form = MapSurvey(p.Form) }),
            bank = Application.Feedback.SurveyPresets.Bank.Select(MapSurveyQuestion),
            suggestions = Application.Feedback.SurveyPresets.Suggestions,
            intro = Application.Feedback.SurveyPresets.Intro,
            otherLabel = Domain.Entities.SurveyForm.OtherLabel,
            limits = new
            {
                questions = Application.Feedback.SurveyFormRules.MaxQuestions,
                options = Application.Feedback.SurveyFormRules.MaxOptions,
                botOptions = Application.Feedback.SurveyFormRules.MaxBotOptions,
                optionLength = Application.Feedback.SurveyFormRules.MaxOptionLength,
                questionLength = Application.Feedback.SurveyFormRules.MaxQuestionLength
            }
        });
    }

    [HttpPost("campaigns/prepare")]
    public async Task<IActionResult> CampaignPrepare(
        [FromBody] CampaignPrepareRequest req, [FromServices] BroadcastCampaignService campaigns, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        if (!TryParseAudience(req.Audience, out var audience))
            return BadRequest(CampaignPrepareResult.Fail($"Неизвестная аудитория: {req.Audience}"));

        var draft = new CampaignDraft
        {
            Key = req.Key, Audience = audience, Message = req.Message,
            ButtonText = req.ButtonText, ButtonQuery = req.ButtonQuery,
            GiftDays = req.GiftDays, GiftOfferDays = req.GiftOfferDays, Survey = req.Survey
        };
        var result = string.IsNullOrWhiteSpace(req.Key) && req.NewSurveySlug != null
            ? await campaigns.PrepareNewSurveyAsync(draft, req.NewSurveySlug, req.SampleSize, req.DryRun, OwnerTelegramId, ct)
            : await campaigns.PrepareAsync(draft, req.SampleSize, req.DryRun, OwnerTelegramId, ct);
        return result.Error != null ? BadRequest(result) : Ok(result);
    }

    public class CampaignSendRequest
    {
        public int Limit { get; set; } = 25;
    }

    [HttpPost("campaigns/{key}/send")]
    public async Task<IActionResult> CampaignSend(
        string key, [FromBody] CampaignSendRequest req, [FromServices] BroadcastCampaignService campaigns, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var result = await campaigns.SendBatchAsync(key, req.Limit, ct);
        if (result.Error != null) return NotFound(result);
        return Ok(new
        {
            result.Sent, result.Blocked, result.Rejected, result.Unknown, result.RetryAfterSeconds,
            status = MapCampaignStatus(result.Status)
        });
    }

    [HttpGet("campaigns/{key}")]
    public async Task<IActionResult> CampaignStatus(
        string key, [FromServices] BroadcastCampaignService campaigns, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var status = await campaigns.GetStatusAsync(key, ct);
        return status == null ? NotFound(new { error = "no_such_campaign" }) : Ok(MapCampaignStatus(status));
    }

    private static object? MapCampaignStatus(CampaignStatus? s) => s == null ? null : new
    {
        s.Key, audience = AudienceName(s.Audience), s.Message, s.ButtonText, s.ButtonQuery, s.CreatedAtUtc,
        s.Total, s.Sample, s.Pending, s.Sent, s.Blocked, s.Rejected, s.Unknown, s.Opened,
        s.GiftDays, s.GiftOfferEndsAtUtc, s.Gifted, s.PlayedVerbSession, s.FinishedVerbSession, s.PaidAfterOpen,
        // In the order of the buttons, also before anyone has answered — this is how the survey builder gets a survey back.
        surveyAnswers = s.SurveyAnswers.Select(MapOptionCount),
        survey = s.Survey == null ? null : MapSurvey(s.Survey)
    };

    internal static object MapSurvey(Domain.Entities.SurveyForm form) => new
    {
        form.Intro, questions = form.Questions.Select(MapSurveyQuestion)
    };

    private static object MapSurveyQuestion(Domain.Entities.SurveyQuestion q) => new
    {
        q.Id, q.Text, kind = SurveyKindName(q.Kind), q.Options, q.AllowOther, q.HeadlineOption, q.HeadlineWithout
    };

    private static string SurveyKindName(Domain.Entities.SurveyQuestionKind kind) =>
        kind == Domain.Entities.SurveyQuestionKind.Text ? "text" : "choice";

    // ---- Feedback: what people answered at the paywall, in surveys and wrote themselves. ----

    /// <param name="kind">paywall | survey | message — only such answers in <c>recent</c>.</param>
    /// <param name="campaign">Only what belongs to this survey campaign in <c>recent</c>.</param>
    [HttpGet("feedback")]
    public async Task<IActionResult> Feedback(
        [FromServices] Application.Feedback.UserFeedbackService feedback, CancellationToken ct,
        [FromQuery] int take = 50, [FromQuery] string? kind = null, [FromQuery] string? campaign = null)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        Domain.Entities.UserFeedbackKind? onlyKind = kind switch
        {
            "paywall" => Domain.Entities.UserFeedbackKind.PaywallDecline,
            "survey" => Domain.Entities.UserFeedbackKind.Survey,
            "message" => Domain.Entities.UserFeedbackKind.Message,
            _ => null
        };
        var overview = await feedback.GetOverviewAsync(take, onlyKind, campaign, ct);
        return Ok(new
        {
            recent = overview.Recent.Select(MapFeedbackItem),
            paywall = new { shown = overview.PaywallShown, options = overview.PaywallOptions.Select(MapOptionCount) },
            messages = overview.Messages,
            surveys = overview.Surveys.Select(MapSurveySummary)
        });
    }

    /// <summary>One survey: the funnel, per question — counts per option and what was written.</summary>
    /// <param name="segment">An option of the first question: count the other questions only for those who chose it.</param>
    [HttpGet("feedback/surveys/{key}")]
    public async Task<IActionResult> SurveyResults(
        string key, [FromServices] Application.Feedback.UserFeedbackService feedback, CancellationToken ct, [FromQuery] string? segment = null)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var results = await feedback.GetSurveyResultsAsync(key, segment, ct);
        if (results == null) return NotFound(new { error = "no_such_survey" });
        return Ok(new
        {
            summary = MapSurveySummary(results.Summary),
            results.Segment,
            questions = results.Questions.Select(q => new
            {
                q.Id, q.Text, kind = SurveyKindName(q.Kind), q.Answered, options = q.Options.Select(MapOptionCount),
                headline = q.Headline == null ? null : new { q.Headline.Option, q.Headline.Without, q.Headline.Chose, q.Headline.Of },
                texts = q.Texts.Select(MapFeedbackItem)
            }),
            written = results.Written.Select(MapFeedbackItem)
        });
    }

    private static object MapSurveySummary(Application.Feedback.SurveySummary s) => new
    {
        s.Key, s.Title, s.Questions, s.CreatedAtUtc, audience = AudienceName(s.Audience), s.Picked, s.Pending,
        funnel = new { s.Funnel.Sent, s.Funnel.AnsweredFirst, s.Funnel.OpenedForm, s.Funnel.Finished }
    };

    private static object MapFeedbackItem(Application.Feedback.FeedbackItem r) => new
    {
        kind = FeedbackKindName(r.Kind), r.CampaignKey, r.QuestionId, r.Option, r.Text, r.AtUtc, r.TelegramId
    };

    private static object MapOptionCount(Application.Feedback.OptionCount c) => new { c.Option, c.Count };

    private static string FeedbackKindName(Domain.Entities.UserFeedbackKind kind) => kind switch
    {
        Domain.Entities.UserFeedbackKind.PaywallDecline => "paywall",
        Domain.Entities.UserFeedbackKind.Survey => "survey",
        _ => "message"
    };

    private static string AudienceName(Domain.Entities.BroadcastAudience a) =>
        char.ToLowerInvariant(a.ToString()[0]) + a.ToString()[1..];

    private static bool TryParseAudience(string? v, out Domain.Entities.BroadcastAudience audience) =>
        Enum.TryParse(v, ignoreCase: true, out audience) && Enum.IsDefined(audience) && !int.TryParse(v, out _);

    private static BroadcastProFilter ParseProStatus(string? v) => v switch
    {
        "active" => BroadcastProFilter.ActiveProOnly,
        "free" => BroadcastProFilter.NoActiveProOnly,
        _ => BroadcastProFilter.Any
    };

    /// <summary>
    /// Returns true ONLY if the request is authenticated via X-Telegram-Init-Data
    /// AND the verified Telegram ID matches the configured owner. Otherwise everything
    /// returns 404 to avoid revealing the admin endpoints.
    /// </summary>
    private async Task<bool> IsOwnerAsync(CancellationToken ct)
    {
        var initData = Request.Headers.TryGetValue(InitDataHeader, out var values)
            ? values.ToString()
            : null;

        var telegramId = TelegramInitDataValidator.ValidateAndGetUserId(initData, _botConfig.Token);
        if (telegramId == null)
        {
            return false;
        }

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        if (telegramId.Value != ownerId)
        {
            return false;
        }

        // Belt-and-suspenders: confirm the user exists in DB
        var exists = await _dbContext.Users.AnyAsync(u => u.TelegramId == telegramId.Value, ct);
        return exists;
    }
}
