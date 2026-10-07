using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.MiniApp;
using Application.MiniApp.Commands;
using Application.MiniApp.Queries;
using Application.MiniApp.Services;
using Application.Translation;
using Application.Translation.Pipeline;
using Application.Verbs;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Domain.Entities;
using Infrastructure.Monitoring;
using Infrastructure.Telegram;
using Infrastructure.Telegram.BotCommands.PaymentCommands;
using MediatR;
using Infrastructure.Telegram.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Telegram.Bot;
using Telegram.Bot.Types.Payments;
using Trale.MiniApp;
using Trale.Services;

namespace Trale.Controllers;

[ApiController]
[Route("api/miniapp")]
public class MiniAppController : Controller
{
    private const string InitDataHeader = "X-Telegram-Init-Data";

    private const int StarsProPrice = 150;

    /// <summary>
    /// Telegram user IDs that get a symbolic 1-star price on all subscription plans —
    /// used exclusively to validate the end-to-end Stars checkout flow against real
    /// Telegram infrastructure without paying full fare each time. All other users
    /// see the normal <see cref="SubscriptionPlans"/> prices.
    /// </summary>
    private static readonly HashSet<long> TestPricingTelegramIds = new()
    {
        309149393, // owner
        866427565,
    };

    private const int TestPricingStars = 1;

    private readonly IGeorgianQuestionsLoaderFactory _questionsLoaderFactory;
    private readonly ITraleDbContext _dbContext;
    private readonly BotConfiguration _botConfig;
    private readonly ITraleMiniAppContentProvider _content;
    private readonly IMediator _mediator;
    private readonly ITelegramBotClient _telegramBotClient;
    private readonly MonetizationMetrics _metrics;
    private readonly ILogger<MiniAppController> _logger;
    private readonly FeedTreatService _feedTreatService;
    private readonly RecordAcquisitionSourceService _acquisitionRecorder;

    public MiniAppController(
        IGeorgianQuestionsLoaderFactory questionsLoaderFactory,
        ITraleDbContext dbContext,
        BotConfiguration botConfig,
        ITraleMiniAppContentProvider content,
        IMediator mediator,
        ITelegramBotClient telegramBotClient,
        MonetizationMetrics metrics,
        ILogger<MiniAppController> logger,
        FeedTreatService feedTreatService,
        RecordAcquisitionSourceService acquisitionRecorder)
    {
        _questionsLoaderFactory = questionsLoaderFactory;
        _dbContext = dbContext;
        _botConfig = botConfig;
        _content = content;
        _mediator = mediator;
        _telegramBotClient = telegramBotClient;
        _metrics = metrics;
        _logger = logger;
        _feedTreatService = feedTreatService;
        _acquisitionRecorder = acquisitionRecorder;
    }

    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { ok = true, ts = DateTime.UtcNow });

    [HttpGet("content")]
    public IActionResult GetContent()
    {
        var catalog = _content.GetCatalog();
        return Ok(new
        {
            botUsername = _botConfig.BotName,
            miniAppEnabled = _botConfig.MiniAppEnabled,
            modules = catalog.Modules
        });
    }

    [HttpGet("modules/{moduleId}/lessons/{lessonId:int}/questions")]
    public async Task<IActionResult> GetModuleLessonQuestions(
        string moduleId,
        int lessonId,
        [FromServices] LessonVerbAnnotator verbAnnotator,
        CancellationToken ct)
    {
        // Legacy "alphabet" module uses the in-memory letter generator (7 auto-chunked lessons).
        // "alphabet-progressive" has its own 10 curated lesson JSONs in Lessons/GeorgianAlphabetProgressive
        // and flows through the generic ModuleRegistry path below — keeping the two in sync is
        // why lessons 8–10 used to 404.
        if (moduleId == "alphabet")
        {
            var alphabetQuestions = _content.GetAlphabetLessonQuestions(lessonId);
            if (alphabetQuestions.Count == 0)
            {
                return NotFound(new { error = "Unknown alphabet lesson" });
            }
            return Ok(alphabetQuestions);
        }

        var moduleDef = ModuleRegistry.Get(moduleId);
        if (moduleDef != null)
        {
            if (lessonId < 1 || lessonId > moduleDef.MaxLessons)
            {
                return NotFound(new { error = "Unknown lesson" });
            }
            var loader = _questionsLoaderFactory.CreateForModuleLesson(moduleDef.Directory, lessonId);
            var questions = loader.LoadQuestions();
            // Verbs are a layer over lessons too: a question that contains a known verb form carries
            // its parse, and the mini-app offers the verb card once the question is answered.
            var verbHits = await verbAnnotator.AnnotateAsync(
                await ResolveUserAsync(ct), questions.Select(LessonQuestionVerbs.ToTexts).ToList(), ct);
            return Ok(MapQuestions(questions, verbHits));
        }

        return NotFound(new { error = "Unknown module" });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Ok(new { authenticated = false });
        }

        var result = await _mediator.Send(new GetMiniAppProfile
        {
            UserId = user.Id
        }, ct);

        return Ok(new
        {
            authenticated = result.Authenticated,
            telegramId = result.TelegramId,
            language = result.Language,
            vocabularyCount = result.VocabularyCount,
            level = result.Level,
            progress = result.Progress,
            isPro = result.IsPro,
            isTrialActive = result.IsTrialActive,
            trialDaysLeft = result.TrialDaysLeft,
            shouldShowReferralExtensionCta = result.ShouldShowReferralExtensionCta,
            subscriptionPlan = result.SubscriptionPlan,
            subscribedUntil = result.SubscribedUntil,
            hasAccess = result.IsPro || result.IsTrialActive,
            isOwner = result.IsOwner,
            onboardingHint = result.OnboardingHint,
            // One-time interface hints already seen — so they do not come back after a reload or on another device.
            uiHintsSeen = result.UiHintsSeen
        });
    }

    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans(CancellationToken ct)
    {
        // Resolve caller so whitelisted test users see the 1⭐ test price in the
        // plan cards, matching what Purchase() will then charge them. Anonymous /
        // unresolved callers fall through to normal SubscriptionPlans prices.
        var user = await ResolveUserAsync(ct);
        var applyTestPricing = user != null && TestPricingTelegramIds.Contains(user.TelegramId);

        var plans = SubscriptionPlans.All.Select(p => new
        {
            id = p.Plan.ToString(),
            payloadId = p.PayloadId,
            stars = applyTestPricing ? TestPricingStars : p.StarsPrice,
            durationDays = p.DurationDays,
            title = p.Title,
            description = p.Description
        });
        return Ok(new { plans });
    }

    public class PurchaseRequest
    {
        public string Plan { get; set; } = string.Empty;
    }

    public class RefundRequest
    {
        public string? ChargeId { get; set; }
    }

    [HttpPost("refund")]
    public async Task<IActionResult> Refund([FromBody] RefundRequest req, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var result = await _mediator.Send(new RefundProStars
        {
            UserId = user.Id,
            ChargeId = req.ChargeId
        }, ct);

        if (result == RefundProStarsResult.Success)
        {
            _metrics.RefundSucceeded.Add(1);
        }
        else
        {
            _metrics.RefundFailed.Add(1, new KeyValuePair<string, object?>("reason", result.ToString()));
        }

        return result switch
        {
            RefundProStarsResult.Success => Ok(new { ok = true }),
            RefundProStarsResult.PaymentNotFound => NotFound(new { error = "payment_not_found" }),
            RefundProStarsResult.AlreadyRefunded => BadRequest(new { error = "already_refunded" }),
            RefundProStarsResult.RefundWindowExpired => BadRequest(new { error = "refund_window_expired" }),
            RefundProStarsResult.TelegramError => StatusCode(502, new { error = "telegram_error" }),
            _ => StatusCode(500, new { error = "unknown" })
        };
    }

    [HttpPost("purchase")]
    public async Task<IActionResult> Purchase([FromBody] PurchaseRequest req, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        // Active-Pro users skip invoice creation; expired-Pro users CAN re-purchase to renew.
        if (user.HasActivePro())
        {
            return Ok(new { ok = true, alreadyPro = true });
        }

        if (!Enum.TryParse<SubscriptionPlan>(req.Plan, true, out var planEnum))
        {
            return BadRequest(new { error = "invalid_plan" });
        }

        var plan = SubscriptionPlans.ByPlan(planEnum);
        if (plan == null)
        {
            return BadRequest(new { error = "invalid_plan" });
        }

        if (TestPricingTelegramIds.Contains(user.TelegramId))
        {
            _logger.LogWarning(
                "Test pricing applied: user {TelegramId} ({UserId}) purchasing {Plan} at {Stars}⭐ instead of {OriginalStars}⭐",
                user.TelegramId, user.Id, plan.Plan, TestPricingStars, plan.StarsPrice);
            plan = plan with { StarsPrice = TestPricingStars };
        }

        try
        {
            // Create invoice link so that Telegram WebApp can open it natively inside the mini-app
            // via Telegram.WebApp.openInvoice(url).
            var link = await _telegramBotClient.CreateInvoiceLinkAsync(
                title: $"Про-доступ — {plan.Title}",
                description: plan.Description,
                payload: plan.PayloadId,
                providerToken: "",
                currency: "XTR",
                prices: new[] { new LabeledPrice(plan.Title, plan.StarsPrice) },
                cancellationToken: ct);

            _metrics.InvoiceCreated.Add(1, new KeyValuePair<string, object?>("plan", plan.Plan.ToString()));

            _logger.LogInformation("Stars invoice link created for user {UserId} plan {Plan}",
                user.Id, plan.Plan);

            return Ok(new { ok = true, invoiceLink = link });
        }
        catch (Exception ex)
        {
            _metrics.PurchaseFailed.Add(1, new KeyValuePair<string, object?>("stage", "invoice_create"));
            _logger.LogError(ex, "Failed to create Stars invoice link for user {UserId}", user.Id);
            return StatusCode(500, new { error = "invoice_failed" });
        }
    }

    public class TreatRequest
    {
        /// <summary>
        /// Index of the treat to purchase (0=Dzval/10xp, 1=Khorci/30xp, 2=Mtsvadi/60xp,
        /// 3=Churchkhela/100xp, 4=Supra/200xp).
        /// </summary>
        public int TreatIndex { get; set; }
    }

    [HttpPost("treat")]
    public async Task<IActionResult> FeedTreat([FromBody] TreatRequest request, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var response = await _feedTreatService.ExecuteAsync(user.Id, request.TreatIndex, ct);

        return response.Result switch
        {
            FeedTreatResult.Success => Ok(new
            {
                ok = true,
                xpSpent = response.XpSpent,
                totalTreatsGiven = response.TotalTreatsGiven,
                lastFedAtUtc = response.LastFedAtUtc,
                lastTreatIndex = response.LastTreatIndex
            }),
            FeedTreatResult.NotEnoughXp => BadRequest(new { error = "not_enough_xp" }),
            FeedTreatResult.InvalidTreatIndex => BadRequest(new { error = "invalid_treat_index" }),
            FeedTreatResult.UserNotFound => Unauthorized(new { error = "user_not_found" }),
            _ => StatusCode(500, new { error = "unknown" })
        };
    }

    public class SetLevelRequest
    {
        public string Level { get; set; } = string.Empty;
    }

    [HttpPost("level")]
    public async Task<IActionResult> SetLevel([FromBody] SetLevelRequest request, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var result = await _mediator.Send(new SetUserLevel
        {
            UserId = user.Id,
            Level = request.Level
        }, ct);

        return result switch
        {
            SetUserLevelResult.Success s => Ok(new { level = s.Level }),
            SetUserLevelResult.InvalidLevel => BadRequest(new { error = "invalid_level" }),
            _ => BadRequest(new { error = "unknown" })
        };
    }

    public class SetNotificationsRequest
    {
        public bool Enabled { get; set; }
    }

    [HttpPost("notifications")]
    public async Task<IActionResult> SetNotifications([FromBody] SetNotificationsRequest request, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        user.NotificationsEnabled = request.Enabled;
        await _dbContext.SaveChangesAsync(ct);
        return Ok(new { notificationsEnabled = user.NotificationsEnabled });
    }

    public class LessonCompleteRequest
    {
        public string ModuleId { get; set; } = string.Empty;
        public int LessonId { get; set; }
        public int Correct { get; set; }
        public int Total { get; set; }
    }

    [HttpPost("progress/lesson-complete")]
    public async Task<IActionResult> CompleteLesson([FromBody] LessonCompleteRequest request, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var result = await _mediator.Send(new CompleteLessonProgress
        {
            UserId = user.Id,
            ModuleId = request.ModuleId,
            LessonId = request.LessonId,
            Correct = request.Correct,
            Total = request.Total
        }, ct);

        return result switch
        {
            CompleteLessonProgressResult.Success s => Ok(new
            {
                xpEarned = s.XpEarned,
                progress = s.Progress
            }),
            CompleteLessonProgressResult.InvalidRequest => BadRequest(new { error = "invalid_request" }),
            _ => BadRequest(new { error = "unknown" })
        };
    }

    public class ProgressAnswerRequest
    {
        public bool Correct { get; set; }
    }

    [HttpPost("progress/answer")]
    public async Task<IActionResult> RecordAnswer([FromBody] ProgressAnswerRequest request, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var result = await _mediator.Send(new RecordLessonAnswer
        {
            UserId = user.Id,
            Correct = request.Correct
        }, ct);

        return result switch
        {
            RecordLessonAnswerResult.Success s => Ok(new
            {
                xpEarned = s.XpEarned,
                progress = s.Progress
            }),
            _ => BadRequest(new { error = "unknown" })
        };
    }

    public class HintSeenRequest
    {
        public string HintKey { get; set; } = string.Empty;
    }

    [HttpPost("onboarding/hint-seen")]
    public async Task<IActionResult> MarkOnboardingHintSeen([FromBody] HintSeenRequest request, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var ok = await _mediator.Send(new Application.MiniApp.Commands.MarkOnboardingHintSeen
        {
            UserId = user.Id,
            HintKey = request.HintKey
        }, ct);

        return ok ? Ok(new { ok = true }) : BadRequest(new { error = "invalid_hint" });
    }

    [HttpGet("referral")]
    public async Task<IActionResult> Referral(
        [FromServices] Application.MiniApp.Queries.GetReferralInfoQuery query,
        CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var info = await query.ExecuteAsync(user.Id, ct);
        if (info == null)
        {
            return NotFound();
        }

        var link = $"https://t.me/{_botConfig.BotName}?start=ref_{info.ReferrerTelegramId}";

        return Ok(new
        {
            link,
            shareText = info.ShareText,
            invitedCount = info.InvitedCount,
            activatedCount = info.ActivatedCount,
            rules = info.Rules,
            // "trial" | "accessEnded" | "pro" | "lifetime" — which reward applies right now.
            state = char.ToLowerInvariant(info.State.ToString()[0]) + info.State.ToString()[1..],
            bonusShortLabel = info.BonusShortLabel,
            inviteLine = info.InviteLine,
            capReached = info.CapReached
        });
    }

    public class CampaignOpenRequest
    {
        public string? Key { get; set; }
    }

    /// <summary>The mini-app was opened by the button of an owner broadcast (<c>?c=key</c> in the
    /// URL). Recorded once per recipient — this is how a campaign's opens are measured.</summary>
    [HttpPost("campaign-open")]
    public async Task<IActionResult> CampaignOpen(
        [FromBody] CampaignOpenRequest request,
        [FromServices] Application.Admin.BroadcastCampaignService campaigns,
        CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var opened = await campaigns.MarkOpenedAsync(user.Id, request?.Key, ct);
        // `gift` is there only in the answer to the open that gave it — the mini-app says it once.
        return Ok(new
        {
            ok = true,
            gift = opened.Gift == null ? null : new { days = opened.Gift.Days, accessUntilUtc = opened.Gift.AccessUntilUtc }
        });
    }

    private static IEnumerable<object> MapQuestions(
        IReadOnlyList<QuizQuestionData> questions, IReadOnlyList<VerbFormHit> verbHits)
    {
        return questions.Select((q, i) => new
        {
            id = q.Id,
            lemma = q.Lemma,
            question = q.Question,
            options = q.Options,
            answerIndex = q.AnswerIndex,
            explanation = q.Explanation,
            questionType = q.QuestionType ?? "choice",
            audioUrl = q.AudioUrl,
            transcript = q.Transcript,
            targetSentence = q.SentenceBuilder != null
                ? new { ru = q.SentenceBuilder.TargetSentence.Ru }
                : (object?)null,
            level = q.SentenceBuilder?.Level,
            correctOrder = q.SentenceBuilder?.CorrectOrder,
            chipPool = q.SentenceBuilder?.ChipPool,
            presetPositions = q.SentenceBuilder?.PresetPositions
                .Select(p => new { position = p.Position, token = p.Token }),
            hints = q.SentenceBuilder?.Hints,
            verb = verbHits[i] == null ? null : VerbHitDto(verbHits[i])
        });
    }

    [HttpGet("activity-days")]
    public async Task<IActionResult> ActivityDays(
        [FromQuery] int days,
        [FromServices] Application.MiniApp.Queries.GetActivityDaysQuery query,
        CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var dates = await query.ExecuteAsync(user.Id, days <= 0 ? 35 : days, ct);
        return Ok(new { dates });
    }

    [HttpGet("vocabulary")]
    public async Task<IActionResult> GetVocabulary(
        [FromServices] GetUserVocabularyQuery query,
        [FromServices] VerbQueries verbs,
        [FromServices] MyVerbsQuery myVerbsQuery,
        CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var result = await query.ExecuteAsync(user.Id, ct);

        // Verbs are a layer over the dictionary: a word or phrase that contains a known verb form
        // carries the parse. An entry that IS a verb form opens the verb view and shows the verb's
        // level; `verbs` is "my verbs" — one row per verb, saved in the dictionary or started elsewhere.
        var myVerbs = await myVerbsQuery.GetAsync(user.Id, result.Items.Select(i => (i.Word, i.Definition)).ToList(), ct);
        var entryVerbs = result.Items.Select((item, n) => (item.Id, Verb: myVerbs.Entries[n])).ToDictionary(e => e.Id, e => e.Verb);
        var starterHits = await verbs.FindInTextsAsync(
            result.StarterItems.SelectMany(i => new[] { i.Word, i.Definition }).ToList(), ct);
        object VerbOf(string word, string definition) =>
            MyVerbsQuery.Find(word, definition, starterHits) is { } found ? VerbHitDto(found.Hit) : null;

        return Ok(new
        {
            language = result.Language,
            items = result.Items.Select(i => new
            {
                id = i.Id,
                word = i.Word,
                definition = i.Definition,
                additionalInfo = i.AdditionalInfo,
                example = i.Example,
                dateAddedUtc = i.DateAddedUtc,
                successCount = i.SuccessCount,
                successReverseCount = i.SuccessReverseCount,
                failedCount = i.FailedCount,
                mastery = i.Mastery,
                isStarter = i.IsStarter,
                verb = entryVerbs[i.Id] == null ? null : DictionaryVerbDto(entryVerbs[i.Id])
            }),
            verbs = myVerbs.Verbs.Select(v => new
            {
                id = v.Lemma,
                title = v.Title,
                ru = v.Translation,
                level = VerbLevelRules.Key(v.Level),
                started = v.Started,
                saved = v.SavedForms.Select(VerbHitDto)
            }),
            starterItems = result.StarterItems.Select(i => new
            {
                id = i.Id,
                word = i.Word,
                definition = i.Definition,
                additionalInfo = i.AdditionalInfo,
                example = i.Example,
                dateAddedUtc = i.DateAddedUtc,
                successCount = i.SuccessCount,
                successReverseCount = i.SuccessReverseCount,
                failedCount = i.FailedCount,
                mastery = i.Mastery,
                isStarter = i.IsStarter,
                audioUrl = i.AudioUrl,
                verb = VerbOf(i.Word, i.Definition)
            })
        });
    }

    public class VocabularyQuizRequest
    {
        public List<Guid> WordIds { get; set; } = new();
        public string Mode { get; set; } = "custom"; // custom | all | new | weak | starter
        public int Count { get; set; } = 10;
    }

    [HttpPost("vocabulary/quiz")]
    public async Task<IActionResult> StartVocabularyQuiz([FromBody] VocabularyQuizRequest request, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var result = await _mediator.Send(new GenerateVocabularyQuiz
        {
            UserId = user.Id,
            WordIds = request.WordIds,
            Mode = request.Mode,
            Count = request.Count
        }, ct);

        return Ok(new
        {
            questions = result.Questions.Select(q => new
            {
                id = q.Id,
                wordId = q.WordId,
                lemma = q.Lemma,
                question = q.Question,
                options = q.Options,
                answerIndex = q.AnswerIndex,
                explanation = q.Explanation,
                direction = q.Direction,
                isStarter = q.IsStarter
            }),
            wordPairs = result.WordPairs.Select(wp => new
            {
                wordId = wp.WordId,
                georgian = wp.Georgian,
                russian = wp.Russian
            }),
            allGeorgian = result.AllGeorgian,
            allRussian = result.AllRussian
        });
    }

    public class VocabularyAnswerRequest
    {
        public Guid? WordId { get; set; }
        public bool Correct { get; set; }
        public string Direction { get; set; } = "ge-to-ru";
    }

    [HttpPost("vocabulary/answer")]
    public async Task<IActionResult> RecordVocabularyAnswer(
        [FromBody] VocabularyAnswerRequest request, [FromServices] VerbQuizCreditService verbCredit, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        // A dictionary entry that is a single verb form stays in the quiz; a correct answer also counts for the verb.
        if (request.Correct && request.WordId != null && user.HasMiniAppAccess())
        {
            await verbCredit.CreditCorrectAnswerAsync(user, request.WordId.Value, DateTime.UtcNow, ct);
        }

        var result = await _mediator.Send(new RecordVocabularyAnswer
        {
            UserId = user.Id,
            WordId = request.WordId,
            Correct = request.Correct,
            Direction = request.Direction
        }, ct);

        return result switch
        {
            RecordVocabularyAnswerResult.Success s => Ok(new
            {
                id = s.Id,
                successCount = s.SuccessCount,
                successReverseCount = s.SuccessReverseCount,
                failedCount = s.FailedCount,
                mastery = s.Mastery
            }),
            RecordVocabularyAnswerResult.Skipped => Ok(new { skipped = true }),
            RecordVocabularyAnswerResult.NotFound => NotFound(),
            _ => BadRequest()
        };
    }

    [HttpDelete("vocabulary/{id}")]
    public async Task<IActionResult> DeleteVocabularyEntry(Guid id, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var entry = await _dbContext.VocabularyEntries.FindAsync([id], ct);
        if (entry == null)
        {
            return NotFound();
        }

        if (entry.UserId != user.Id)
        {
            return Forbid();
        }

        await _mediator.Send(new Application.VocabularyEntries.Commands.RemoveVocabularyEntry
        {
            VocabularyEntryId = id
        }, ct);

        return NoContent();
    }

    public class TranslateWordRequest
    {
        public string Word { get; set; } = string.Empty;
    }

    /// <summary>
    /// The translation runs as a job of its own (<see cref="TranslationJobs"/>): a verb the models have to
    /// write takes up to a minute or two, longer than a proxy keeps the request. An answer that is ready
    /// within a few seconds is returned as before; otherwise the status is <c>pending</c> and the
    /// mini-app asks <c>translate/status</c> until the answer is there. By then the job is on record in
    /// the database, so any instance can say what became of it.
    /// </summary>
    [HttpPost("translate")]
    public async Task<IActionResult> TranslateWord(
        [FromBody] TranslateWordRequest request,
        [FromServices] VerbQueries verbs,
        [FromServices] TranslationJobs jobs,
        [FromServices] IOptions<TranslationAgentOptions> options,
        CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        if (string.IsNullOrWhiteSpace(request.Word) || request.Word.Trim().Length > LearningConstants.Vocabulary.MaxWordLength)
        {
            return BadRequest(new { error = "invalid_word" });
        }

        var word = request.Word.Trim();
        var (job, elsewhere) = await jobs.StartOrJoinAsync(user.Id, word, ct);
        if (job == null)
        {
            // Another instance is on it.
            return Ok(new { status = "pending", verbLookup = elsewhere.VerbLookup });
        }

        var wait = Task.Delay(Math.Max(0, options.Value.MiniAppTranslateWaitMs), ct);
        if (await Task.WhenAny(job.Translation, wait) == job.Translation && job.QueuedId == null)
        {
            jobs.Forget(user.Id, word);
            return await TranslationAnswer(await job.Translation, word, verbs, ct);
        }

        // Before the mini-app is told to ask again, the job is on record — the question may reach another instance.
        await Task.WhenAny(job.Completion, job.Queued).WaitAsync(ct);
        return await TranslationJobStatus(user.Id, word, job, jobs, verbs, ct);
    }

    /// <summary>
    /// What became of a translation that answered <c>pending</c>. Never starts one. The instance that
    /// runs the job knows it first-hand; any other answers from the job's record in the database
    /// (<see cref="QueuedTranslation"/>) — pending, the answer, or a failure. With neither, the word
    /// saved to the dictionary is the answer, and the status is <c>pending</c> until then.
    /// </summary>
    [HttpPost("translate/status")]
    public async Task<IActionResult> TranslateWordStatus(
        [FromBody] TranslateWordRequest request,
        [FromServices] VerbQueries verbs,
        [FromServices] TranslationJobs jobs,
        CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var word = (request.Word ?? string.Empty).Trim();
        var job = jobs.Find(user.Id, word);
        if (job != null)
        {
            return await TranslationJobStatus(user.Id, word, job, jobs, verbs, ct);
        }

        var queued = await jobs.FindQueuedAsync(user.Id, word, ct);
        if (queued != null)
        {
            return await QueuedTranslationStatus(queued, word, verbs, ct);
        }

        var typed = word.ToLowerInvariant();
        var saved = await _dbContext.VocabularyEntries
            .AsNoTracking()
            .Where(e => e.UserId == user.Id && e.Word == typed)
            .OrderByDescending(e => e.DateAddedUtc)
            .FirstOrDefaultAsync(ct);
        return saved == null
            ? Ok(new { status = "pending", verbLookup = false })
            : await TranslationAnswer(
                new CreateVocabularyEntryResult.TranslationSuccess(saved.Definition, saved.AdditionalInfo, saved.Example, saved.Id),
                word, verbs, ct);
    }

    /// <summary>The state of a job this instance started. Once the job is on record, the record decides: a failed run may be followed by another.</summary>
    private async Task<IActionResult> TranslationJobStatus(
        Guid userId, string word, TranslationJob job, TranslationJobs jobs, VerbQueries verbs, CancellationToken ct)
    {
        var queued = job.QueuedId is { } id ? await jobs.FindQueuedAsync(id, ct) : null;
        if (queued is { IsFinished: false } || (queued == null && !job.Translation.IsCompleted))
        {
            return Ok(new { status = "pending", verbLookup = job.VerbLookupStarted.IsCompleted || queued?.VerbLookup == true });
        }

        jobs.Forget(userId, word);
        if (job.Translation.IsCompletedSuccessfully && queued?.State != QueuedTranslationState.Failed)
        {
            return await TranslationAnswer(job.Translation.Result, word, verbs, ct);
        }

        return queued == null ? Ok(new { status = "failure" }) : await QueuedTranslationStatus(queued, word, verbs, ct);
    }

    /// <summary>The state of a job as its record in the database tells it — all an instance that does not run the job knows.</summary>
    private async Task<IActionResult> QueuedTranslationStatus(
        QueuedTranslation queued, string word, VerbQueries verbs, CancellationToken ct)
    {
        if (!queued.IsFinished)
        {
            return Ok(new { status = "pending", verbLookup = queued.VerbLookup });
        }

        var saved = queued.VocabularyEntryId is { } entryId
            ? await _dbContext.VocabularyEntries.AsNoTracking().FirstOrDefaultAsync(e => e.Id == entryId, ct)
            : null;
        CreateVocabularyEntryResult result = queued.Outcome switch
        {
            _ when queued.State == QueuedTranslationState.Failed => new CreateVocabularyEntryResult.TranslationFailure(),
            QueuedTranslationOutcome.Success when saved != null =>
                new CreateVocabularyEntryResult.TranslationSuccess(saved.Definition, saved.AdditionalInfo, saved.Example, saved.Id),
            QueuedTranslationOutcome.Exists when saved != null =>
                new CreateVocabularyEntryResult.TranslationExists(saved.Definition, saved.AdditionalInfo, saved.Example, saved.Id),
            QueuedTranslationOutcome.NotAWord => new CreateVocabularyEntryResult.NotTranslatable(),
            QueuedTranslationOutcome.TooLong => new CreateVocabularyEntryResult.PromptLengthExceeded(),
            QueuedTranslationOutcome.Emoji => new CreateVocabularyEntryResult.EmojiDetected(),
            _ => new CreateVocabularyEntryResult.TranslationFailure()
        };
        return await TranslationAnswer(result, word, verbs, ct);
    }

    private async Task<IActionResult> TranslationAnswer(
        CreateVocabularyEntryResult result, string word, VerbQueries verbs, CancellationToken ct)
    {
        word = word.ToLowerInvariant();

        async Task<object> VerbIn(string definition)
        {
            var hits = await verbs.FindInTextsAsync(new[] { word, definition }, ct);
            return hits.TryGetValue(word, out var hit) || hits.TryGetValue(definition, out hit) ? VerbHitDto(hit) : null;
        }

        return result switch
        {
            CreateVocabularyEntryResult.TranslationSuccess s => Ok(new
            {
                status = "success",
                word,
                definition = s.Definition,
                additionalInfo = s.AdditionalInfo,
                example = s.Example,
                vocabularyEntryId = s.VocabularyEntryId,
                verb = await VerbIn(s.Definition)
            }),
            CreateVocabularyEntryResult.TranslationExists e => Ok(new
            {
                status = "exists",
                word,
                definition = e.Definition,
                additionalInfo = e.AdditionalInfo,
                example = e.Example,
                vocabularyEntryId = e.VocabularyEntryId,
                verb = await VerbIn(e.Definition)
            }),
            CreateVocabularyEntryResult.TranslationFailure => Ok(new { status = "failure" }),
            // Gibberish or a message to the bot: nothing was translated or saved; the screen says so.
            CreateVocabularyEntryResult.NotTranslatable => Ok(new { status = "not_a_word" }),
            CreateVocabularyEntryResult.PromptLengthExceeded => BadRequest(new { status = "too_long" }),
            CreateVocabularyEntryResult.EmojiDetected => BadRequest(new { status = "emoji" }),
            _ => Ok(new { status = "failure" })
        };
    }

    // ── Verbs ────────────────────────────────────────────────────────────────
    // The "Глаголы" section sits behind the same entitlement as the rest of the mini-app
    // (trial or Pro): it is what people come for, so there is no free preview.

    [HttpGet("verbs")]
    public async Task<IActionResult> GetVerbs([FromServices] VerbQueries verbs, CancellationToken ct)
    {
        var denied = await DenyVerbsAccessAsync(ct);
        if (denied != null) return denied;

        var list = await verbs.ListAsync(ct);
        return Ok(new
        {
            verbs = list.Select(v => new
            {
                id = v.Lemma,
                title = v.Title,
                ru = v.Translation,
                kind = v.Kind,
                present = System.Text.Json.JsonSerializer.Deserialize<string[]>(v.PresentJson),
                status = RuntimeVerbStore.StatusName(v.Status)
            })
        });
    }

    [HttpGet("verbs/parse")]
    public async Task<IActionResult> ParseVerbForm(
        [FromQuery] string form,
        [FromServices] VerbQueries verbs,
        CancellationToken ct)
    {
        var denied = await DenyVerbsAccessAsync(ct);
        if (denied != null) return denied;

        var hits = await verbs.ParseAsync(form ?? string.Empty, ct);
        return Ok(new
        {
            hits = hits.Select(VerbHitDto)
        });
    }

    /// <summary>What the dashboard may say about verbs in its "what next" block.</summary>
    [HttpGet("verbs/summary")]
    public async Task<IActionResult> GetVerbsSummary(
        [FromServices] DictionaryVerbsQuery dictionaryVerbs, [FromServices] MyVerbsQuery myVerbs, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        if (!user.HasMiniAppAccess())
        {
            return StatusCode(402, new { error = "subscription_required" });
        }

        var next = await myVerbs.ContinueAsync(user.Id, ct);
        return Ok(new
        {
            dictionaryVerbs = await dictionaryVerbs.CountAsync(user, ct),
            // The verb being learned, most recently played first — "continue verb X" on the dashboard.
            continueVerb = next == null
                ? null
                : new { id = next.Lemma, title = next.Title, ru = next.Translation, level = VerbLevelRules.Key(next.Level) }
        });
    }

    public class VerbSectionOpenRequest
    {
        public string? Source { get; set; }
    }

    /// <summary>
    /// The «Глаголы» section in one call: the ladder (levels → packs → verbs) with the learner's
    /// level of every verb, their own verbs and what to do now. Open to a caller without trial/Pro
    /// too — the section must not be a dead end for them — but then it is an overview only: Russian
    /// names and counts, no Georgian and no verb ids; playing or opening a verb stays behind 402.
    /// </summary>
    [HttpGet("verbs/section")]
    public async Task<IActionResult> GetVerbSection([FromServices] VerbSectionQuery section, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var access = user.HasMiniAppAccess();
        var s = await section.GetAsync(user, AlphabetLessons, DateTime.UtcNow, ct);
        return Ok(new
        {
            hasAccess = access,
            total = s.Total,
            learned = s.Learned,
            currentLevel = s.CurrentLevelId,
            alphabetHint = s.AlphabetHint,
            examples = s.Examples,
            next = s.Next == null ? null : new
            {
                kind = s.Next.Kind,
                id = access ? s.Next.Lemma : null,
                title = access ? s.Next.Title : null,
                ru = s.Next.Translation,
                level = VerbLevelRules.Key(s.Next.Level),
                due = s.Next.Due,
                levelId = s.Next.LevelId,
                packId = s.Next.PackId,
                packTitle = s.Next.PackTitle
            },
            myVerbs = s.MyVerbs.Select(v => new
            {
                id = access ? v.Lemma : null,
                title = access ? v.Title : null,
                ru = v.Translation,
                level = VerbLevelRules.Key(v.Level),
                generated = v.Generated,
                levelId = v.LevelId,
                packId = v.PackId
            }),
            levels = s.Levels.Select(l => new
            {
                id = l.Id,
                title = l.Title,
                packs = l.Packs.Select(p => new
                {
                    id = p.Id,
                    title = p.Title,
                    verbs = p.Verbs.Select(v => new
                    {
                        id = access ? v.Lemma : null,
                        title = access ? v.Title : null,
                        ru = v.Translation,
                        level = VerbLevelRules.Key(v.Level),
                        due = v.Due
                    })
                })
            })
        });
    }

    /// <summary>The section was opened, and by what way (dashboard tile, broadcast button, a tagged link).</summary>
    [HttpPost("verbs/section/open")]
    public async Task<IActionResult> VerbSectionOpened(
        [FromBody] VerbSectionOpenRequest request, [FromServices] RecordVerbSectionVisitService visits, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var source = await visits.ExecuteAsync(user.Id, request?.Source, DateTime.UtcNow, ct);
        return source == null ? BadRequest(new { error = "invalid_source" }) : Ok(new { ok = true });
    }

    [HttpGet("verbs/{id}")]
    public async Task<IActionResult> GetVerb(string id, [FromServices] VerbQueries verbs, CancellationToken ct)
    {
        var denied = await DenyVerbsAccessAsync(ct);
        if (denied != null) return denied;

        var card = await verbs.GetCardJsonAsync(id, ct);
        if (card == null)
        {
            return NotFound(new { error = "Unknown verb" });
        }

        // Stored exactly as the mini-app expects it — served as is.
        return Content(card, "application/json");
    }

    // ── Verb ladder: per-form learning progress ──────────────────────────────

    public class SaveVerbProgressRequest
    {
        public List<VerbProgressItem> Forms { get; set; }
    }

    public class VerbProgressItem
    {
        public string Tense { get; set; }
        public int Person { get; set; }
        public int Step { get; set; }
        public int Reviews { get; set; }
        /// <summary>When the learner answered (client clock) — saves are last-write-wins by it.</summary>
        public DateTimeOffset At { get; set; }
    }

    /// <summary>Verbs the user is learning, with counts and how many forms are due for repetition.</summary>
    [HttpGet("verbs/progress")]
    public async Task<IActionResult> GetVerbsInProgress([FromServices] VerbProgressService progress, CancellationToken ct)
    {
        var (user, denied) = await ResolveVerbsUserAsync(ct);
        if (denied != null) return denied;

        var summary = await progress.GetSummaryAsync(user.Id, DateTime.UtcNow, ct);
        return Ok(new
        {
            dueForms = summary.DueForms,
            verbs = summary.Verbs.Select(v => new
            {
                id = v.Lemma,
                title = v.Title,
                ru = v.Translation,
                started = v.Started,
                mastered = v.Mastered,
                total = v.Total,
                due = v.Due,
                updatedAtUtc = v.UpdatedAtUtc
            })
        });
    }

    [HttpGet("verbs/{id}/progress")]
    public async Task<IActionResult> GetVerbProgress(string id, [FromServices] VerbProgressService progress, CancellationToken ct)
    {
        var (user, denied) = await ResolveVerbsUserAsync(ct);
        if (denied != null) return denied;

        var state = await progress.GetAsync(user.Id, id, DateTime.UtcNow, ct);
        return state == null ? NotFound(new { error = "Unknown verb" }) : Ok(VerbProgressDto(state));
    }

    /// <summary>Saves answered ladder steps. Idempotent: the mini-app replays a batch until it gets through.</summary>
    [HttpPost("verbs/{id}/progress")]
    public async Task<IActionResult> SaveVerbProgress(
        string id,
        [FromBody] SaveVerbProgressRequest request,
        [FromServices] VerbProgressService progress,
        CancellationToken ct)
    {
        var (user, denied) = await ResolveVerbsUserAsync(ct);
        if (denied != null) return denied;

        if (request?.Forms == null || request.Forms.Count > VerbProgressService.MaxBatchSize)
        {
            return BadRequest(new { error = "invalid_forms" });
        }

        var steps = request.Forms
            .Where(f => f != null)
            .Select(f => new VerbFormStep(f.Tense, f.Person, f.Step, f.Reviews, f.At.UtcDateTime))
            .ToList();
        var state = await progress.SaveAsync(user.Id, id, steps, DateTime.UtcNow, ct);
        return state == null ? NotFound(new { error = "Unknown verb" }) : Ok(VerbProgressDto(state));
    }

    // ── Verb sessions: the verb as the learner's own thing ───────────────────

    public class VerbSessionRequest
    {
        public Guid SessionId { get; set; }
        /// <summary>The composed session (JSON); needed with the first report of a session.</summary>
        public Newtonsoft.Json.Linq.JToken Plan { get; set; }
        public int Scene { get; set; }
        public int Done { get; set; }
        public List<VerbProgressItem> Forms { get; set; }
        public bool Finished { get; set; }
        public List<string> Scenes { get; set; }
        public bool StoryCompleted { get; set; }
        public int ExamAsked { get; set; }
        public int ExamCorrect { get; set; }
    }

    /// <summary>
    /// Everything the verb view and the session director need about one verb for this learner:
    /// form progress, level, what was played before, the learner in general and the unfinished session.
    /// </summary>
    [HttpGet("verbs/{id}/learning")]
    public async Task<IActionResult> GetVerbLearning(string id, [FromServices] VerbLearningService learning, CancellationToken ct)
    {
        var (user, denied) = await ResolveVerbsUserAsync(ct);
        if (denied != null) return denied;

        var state = await learning.GetAsync(user, id, AlphabetLessons, DateTime.UtcNow, ct);
        return state == null ? NotFound(new { error = "Unknown verb" }) : Ok(VerbLearningDto(state));
    }

    /// <summary>
    /// Reports where a session is: answered forms, position, and — once — that it is finished.
    /// Idempotent: the mini-app replays a report until it gets through; a finished session is credited once.
    /// </summary>
    [HttpPost("verbs/{id}/session")]
    public async Task<IActionResult> SaveVerbSession(
        string id,
        [FromBody] VerbSessionRequest request,
        [FromServices] VerbLearningService learning,
        CancellationToken ct)
    {
        var (user, denied) = await ResolveVerbsUserAsync(ct);
        if (denied != null) return denied;

        var forms = request?.Forms ?? new List<VerbProgressItem>();
        if (request == null || request.SessionId == Guid.Empty || forms.Count > VerbProgressService.MaxBatchSize)
        {
            return BadRequest(new { error = "invalid_session" });
        }

        var report = new VerbSessionReport(
            request.SessionId,
            request.Plan?.ToString(Newtonsoft.Json.Formatting.None),
            request.Scene,
            request.Done,
            forms.Where(f => f != null).Select(f => new VerbFormStep(f.Tense, f.Person, f.Step, f.Reviews, f.At.UtcDateTime)).ToList(),
            request.Finished,
            request.Scenes ?? new List<string>(),
            request.StoryCompleted,
            request.ExamAsked,
            request.ExamCorrect);
        var outcome = await learning.SaveAsync(user, id, report, AlphabetLessons, DateTime.UtcNow, ct);
        return outcome == null
            ? NotFound(new { error = "Unknown verb or session" })
            : Ok(new { state = VerbLearningDto(outcome.State), xpEarned = outcome.XpEarned, progress = outcome.Progress });
    }

    private static int AlphabetLessons => ModuleRegistry.Get(LearningConstants.Modules.Alphabet)?.MaxLessons ?? 0;

    private static object VerbLearningDto(VerbLearningState s) => new
    {
        progress = VerbProgressDto(s.Progress),
        level = VerbLevelRules.Key(s.Level),
        memory = new
        {
            sessionsPlayed = s.Memory.SessionsPlayed,
            recentScenes = s.Memory.RecentScenes,
            storyCompleted = s.Memory.StoryCompleted,
            examPassed = s.Memory.ExamPassed
        },
        learner = new
        {
            level = s.Learner.Level,
            canType = s.Learner.CanType,
            dictionarySize = s.Learner.DictionarySize,
            dictionaryVerbs = s.Learner.DictionaryVerbs,
            verbsLearned = s.Learner.VerbsLearned
        },
        session = s.Session == null ? null : new
        {
            id = s.Session.Id,
            // Stored as the mini-app sent it; handed back as JSON, not as a string.
            plan = Newtonsoft.Json.Linq.JToken.Parse(s.Session.PlanJson),
            scene = s.Session.Scene,
            done = s.Session.Done
        }
    };

    private static object VerbProgressDto(VerbProgressState s) => new
    {
        verbId = s.Lemma,
        canLearn = s.CanLearn,
        total = s.Total,
        forms = s.Forms.Select(f => new
        {
            tense = f.Tense,
            person = f.Person,
            step = f.Step,
            bestStep = f.BestStep,
            reviews = f.Reviews,
            nextDueAtUtc = f.NextDueAtUtc,
            due = f.Due
        })
    };

    /// <summary>The caller when they may use the verbs section; otherwise the response to return.</summary>
    private async Task<(User User, IActionResult Denied)> ResolveVerbsUserAsync(CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return (null, Unauthorized(new { error = "not_authenticated" }));
        }

        return user.HasMiniAppAccess()
            ? (user, null)
            : (null, StatusCode(402, new { error = "subscription_required" }));
    }

    /// <summary>
    /// Comic stories of a verb with their lines already resolved from the catalog. An empty list
    /// when the verb has none (or is unknown) — the verb card then simply shows no stories.
    /// </summary>
    [HttpGet("verbs/{id}/stories")]
    public async Task<IActionResult> GetVerbStories(string id, [FromServices] VerbStoryCatalog stories, CancellationToken ct)
    {
        var denied = await DenyVerbsAccessAsync(ct);
        if (denied != null) return denied;

        return Ok(new { stories = stories.ForVerb(id) });
    }

    /// <summary>The parse of a dictionary entry plus what makes it "a verb of mine": is it the form alone, and the verb's level.</summary>
    private static object DictionaryVerbDto(DictionaryVerbHit v) => new
    {
        form = v.Hit.Form,
        verbId = v.Hit.Lemma,
        title = v.Hit.Title,
        ru = v.Hit.Translation,
        tense = v.Hit.Tense,
        person = v.Hit.Person,
        meaning = v.Hit.Meaning,
        meaningNote = v.Hit.MeaningNote,
        single = v.Single,
        level = VerbLevelRules.Key(v.Level)
    };

    private static object VerbHitDto(VerbFormHit h) => new
    {
        form = h.Form,
        verbId = h.Lemma,
        title = h.Title,
        ru = h.Translation,
        tense = h.Tense,
        person = h.Person,
        // The form in plain Russian («я хотел(а)») and, rarely, a note that tells two tenses apart.
        meaning = h.Meaning,
        meaningNote = h.MeaningNote
    };

    /// <summary>Null when the caller may use the verbs section; otherwise the response to return.</summary>
    private async Task<IActionResult> DenyVerbsAccessAsync(CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        return user.HasMiniAppAccess()
            ? null
            : StatusCode(402, new { error = "subscription_required" });
    }

    private async Task<User> ResolveUserAsync(CancellationToken ct)
    {
        var initData = Request.Headers.TryGetValue(InitDataHeader, out var values)
            ? values.ToString()
            : null;

        var telegramId = TelegramInitDataValidator.ValidateAndGetUserId(initData, _botConfig.Token);
        if (telegramId == null)
        {
            return null;
        }

        var user = await _dbContext.Users
            .Include(u => u.Settings)
            .FirstOrDefaultAsync(u => u.TelegramId == telegramId.Value, ct);

        // First-touch attribution for users who arrive straight into the mini-app via
        // a t.me/bot/app?startapp=<source> deep-link. Only when the user has no source
        // yet; the service no-ops otherwise, so this stays a one-time write.
        if (user != null && string.IsNullOrEmpty(user.AcquisitionSource))
        {
            var startParam = TelegramInitDataValidator.TryGetStartParam(initData);
            if (startParam != null)
            {
                await _acquisitionRecorder.ExecuteAsync(user.Id, startParam, ct);
            }
        }

        return user;
    }
}
