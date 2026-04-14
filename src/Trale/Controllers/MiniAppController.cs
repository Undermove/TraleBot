using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.MiniApp.Commands;
using Application.MiniApp.Queries;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Domain.Entities;
using Infrastructure.Telegram;
using MediatR;
using Infrastructure.Telegram.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Trale.MiniApp;
using Trale.Services;

namespace Trale.Controllers;

[ApiController]
[Route("api/miniapp")]
public class MiniAppController : Controller
{
    private const string InitDataHeader = "X-Telegram-Init-Data";

    private readonly IGeorgianQuestionsLoaderFactory _questionsLoaderFactory;
    private readonly ITraleDbContext _dbContext;
    private readonly BotConfiguration _botConfig;
    private readonly ITraleMiniAppContentProvider _content;
    private readonly IMediator _mediator;

    public MiniAppController(
        IGeorgianQuestionsLoaderFactory questionsLoaderFactory,
        ITraleDbContext dbContext,
        BotConfiguration botConfig,
        ITraleMiniAppContentProvider content,
        IMediator mediator)
    {
        _questionsLoaderFactory = questionsLoaderFactory;
        _dbContext = dbContext;
        _botConfig = botConfig;
        _content = content;
        _mediator = mediator;
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
        if (moduleId == "alphabet")
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
            language = result.Language,
            vocabularyCount = result.VocabularyCount,
            level = result.Level,
            progress = result.Progress
        });
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

    private static IEnumerable<object> MapQuestions(IGeorgianQuestionsLoader loader, int lessonId)
    {
        return loader.LoadQuestionsForLesson(lessonId).Select(q => new
        {
            id = q.Id,
            lemma = q.Lemma,
            question = q.Question,
            options = q.Options,
            answerIndex = q.AnswerIndex,
            explanation = q.Explanation
        });
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
