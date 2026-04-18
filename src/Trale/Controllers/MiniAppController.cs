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

    private readonly IGeorgianQuestionsLoaderFactory _questionsLoaderFactory;
    private readonly ITraleDbContext _dbContext;
    private readonly BotConfiguration _botConfig;
    private readonly ITraleMiniAppContentProvider _content;
    private readonly IMediator _mediator;
    private readonly ITelegramBotClient _telegramBotClient;
    private readonly MonetizationMetrics _metrics;
    private readonly ILogger<MiniAppController> _logger;
    private readonly FeedTreatService _feedTreatService;

    public MiniAppController(
        IGeorgianQuestionsLoaderFactory questionsLoaderFactory,
        ITraleDbContext dbContext,
        BotConfiguration botConfig,
        ITraleMiniAppContentProvider content,
        IMediator mediator,
        ITelegramBotClient telegramBotClient,
        MonetizationMetrics metrics,
        ILogger<MiniAppController> logger,
        FeedTreatService feedTreatService)
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
    public IActionResult GetModuleLessonQuestions(string moduleId, int lessonId)
    {
        if (moduleId is "alphabet" or "alphabet-progressive")
        {
            var alphabetQuestions = _content.GetAlphabetLessonQuestions(lessonId);
            if (alphabetQuestions.Count == 0)
            {
                return NotFound(new { error = "Unknown alphabet lesson" });
            }
            return Ok(alphabetQuestions);
        }

        if (moduleId == "verbs-of-movement")
        {
            if (lessonId < 1 || lessonId > 11)
            {
                return NotFound(new { error = "Unknown lesson" });
            }
            var loader = _questionsLoaderFactory.CreateForLesson(lessonId);
            return Ok(MapQuestions(loader, lessonId));
        }

        var moduleDef = ModuleRegistry.Get(moduleId);
        if (moduleDef != null)
        {
            if (lessonId < 1 || lessonId > moduleDef.MaxLessons)
            {
                return NotFound(new { error = "Unknown lesson" });
            }
            var loader = _questionsLoaderFactory.CreateForModuleLesson(moduleDef.Directory, lessonId);
            return Ok(MapQuestions(loader, lessonId));
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
            subscriptionPlan = result.SubscriptionPlan,
            subscribedUntil = result.SubscribedUntil,
            hasAccess = result.IsPro || result.IsTrialActive,
            isOwner = result.IsOwner
        });
    }

    [HttpGet("plans")]
    public IActionResult GetPlans()
    {
        var plans = SubscriptionPlans.All.Select(p => new
        {
            id = p.Plan.ToString(),
            payloadId = p.PayloadId,
            stars = p.StarsPrice,
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

        if (user.IsPro)
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
                lastFedAtUtc = response.LastFedAtUtc
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
        var shareText = "Учу грузинский в TraleBot 🇬🇪 — приходи, тебе дадут 60 дней триала вместо 30.";

        return Ok(new
        {
            link,
            shareText,
            invitedCount = info.InvitedCount,
            activatedCount = info.ActivatedCount,
            bonusLabel = info.BonusLabel,
            todayActivated = info.TodayActivated,
            dailyLimit = info.DailyLimit,
            yearActivated = info.YearActivated,
            yearlyLimit = info.YearlyLimit,
            trialCapReached = info.TrialCapReached,
            trialLimit = info.TrialLimit
        });
    }

    private static IEnumerable<object> MapQuestions(IGeorgianQuestionsLoader loader, int lessonId)
    {
        return loader.LoadQuestionsForLesson(lessonId).Select(q => new
        {
            id = q.Id,
            lemma = q.Lemma,
            question = q.Question,
            options = q.Options,
            answerIndex = q.AnswerIndex,
            explanation = q.Explanation,
            questionType = q.QuestionType ?? "choice"
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
    public async Task<IActionResult> GetVocabulary(CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var result = await _mediator.Send(new GetUserVocabulary
        {
            UserId = user.Id
        }, ct);

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
                isStarter = i.IsStarter
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
                isStarter = i.IsStarter
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
    public async Task<IActionResult> RecordVocabularyAnswer([FromBody] VocabularyAnswerRequest request, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
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

    [HttpPost("translate")]
    public async Task<IActionResult> TranslateWord([FromBody] TranslateWordRequest request, CancellationToken ct)
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

        var result = await _mediator.Send(new TranslateAndCreateVocabularyEntry
        {
            UserId = user.Id,
            Word = request.Word.Trim()
        }, ct);

        return result switch
        {
            CreateVocabularyEntryResult.TranslationSuccess s => Ok(new
            {
                status = "success",
                word = request.Word.Trim().ToLowerInvariant(),
                definition = s.Definition,
                additionalInfo = s.AdditionalInfo,
                example = s.Example,
                vocabularyEntryId = s.VocabularyEntryId
            }),
            CreateVocabularyEntryResult.TranslationExists e => Ok(new
            {
                status = "exists",
                word = request.Word.Trim().ToLowerInvariant(),
                definition = e.Definition,
                additionalInfo = e.AdditionalInfo,
                example = e.Example,
                vocabularyEntryId = e.VocabularyEntryId
            }),
            CreateVocabularyEntryResult.TranslationFailure => Ok(new { status = "failure" }),
            CreateVocabularyEntryResult.PromptLengthExceeded => BadRequest(new { status = "too_long" }),
            CreateVocabularyEntryResult.EmojiDetected => BadRequest(new { status = "emoji" }),
            _ => Ok(new { status = "failure" })
        };
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

        return user;
    }
}
