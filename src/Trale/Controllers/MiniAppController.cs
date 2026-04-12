using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Infrastructure.Telegram;
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
    private const int MaxVocabularyQuizQuestions = 15;

    private readonly IGeorgianQuestionsLoaderFactory _questionsLoaderFactory;
    private readonly ITraleDbContext _dbContext;
    private readonly BotConfiguration _botConfig;
    private readonly IMiniAppContentProvider _content;

    public MiniAppController(
        IGeorgianQuestionsLoaderFactory questionsLoaderFactory,
        ITraleDbContext dbContext,
        BotConfiguration botConfig,
        IMiniAppContentProvider content)
    {
        _questionsLoaderFactory = questionsLoaderFactory;
        _dbContext = dbContext;
        _botConfig = botConfig;
        _content = content;
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
            var questions = loader.LoadQuestionsForLesson(lessonId);
            var dto = questions.Select(q => new
            {
                id = q.Id,
                lemma = q.Lemma,
                question = q.Question,
                options = q.Options,
                answerIndex = q.AnswerIndex,
                explanation = q.Explanation
            });
            return Ok(dto);
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

        var progress = await LoadOrCreateProgressAsync(user, ct);
        await _dbContext.SaveChangesAsync(ct);

        var vocabCount = await _dbContext.VocabularyEntries
            .Where(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage)
            .CountAsync(ct);

        return Ok(new
        {
            authenticated = true,
            language = user.Settings.CurrentLanguage.ToString(),
            vocabularyCount = vocabCount,
            progress = SerializeProgress(progress)
        });
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

        if (string.IsNullOrWhiteSpace(request.ModuleId) || request.Total <= 0)
        {
            return BadRequest(new { error = "invalid_request" });
        }

        var progress = await LoadOrCreateProgressAsync(user, ct);

        // XP calc: up to 20 XP for a 100% lesson, half XP for repeats
        var completed = ParseCompletedLessons(progress.CompletedLessonsJson);
        if (!completed.TryGetValue(request.ModuleId, out var lessons))
        {
            lessons = new List<int>();
        }

        var wasFirst = request.LessonId > 0 && !lessons.Contains(request.LessonId);
        var correctRatio = Math.Clamp((double)request.Correct / request.Total, 0, 1);
        var baseXp = (int)Math.Round(correctRatio * 20);
        var xpEarned = wasFirst ? baseXp : Math.Max(1, baseXp / 2);

        progress.Xp += xpEarned;

        // Streak: update if new day
        var todayUtc = DateTime.UtcNow.Date;
        if (progress.LastPlayedAtUtc == null)
        {
            progress.Streak = 1;
        }
        else
        {
            var last = progress.LastPlayedAtUtc.Value.Date;
            if (last == todayUtc)
            {
                // same day — keep streak
            }
            else if (last == todayUtc.AddDays(-1))
            {
                progress.Streak += 1;
            }
            else
            {
                progress.Streak = 1;
            }
        }
        progress.LastPlayedAtUtc = DateTime.UtcNow;

        // Record completion — only for real module lessons (skip "vocabulary" pseudo-module)
        if (request.LessonId > 0 && request.ModuleId != "vocabulary")
        {
            if (!lessons.Contains(request.LessonId))
            {
                lessons.Add(request.LessonId);
                lessons.Sort();
            }
            completed[request.ModuleId] = lessons;
            progress.CompletedLessonsJson = JsonSerializer.Serialize(completed);
        }

        progress.UpdatedAtUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new
        {
            xpEarned,
            progress = SerializeProgress(progress)
        });
    }

    private async Task<MiniAppUserProgress> LoadOrCreateProgressAsync(User user, CancellationToken ct)
    {
        var progress = await _dbContext.MiniAppUserProgresses
            .FirstOrDefaultAsync(p => p.UserId == user.Id, ct);

        if (progress != null)
        {
            return progress;
        }

        var now = DateTime.UtcNow;
        progress = new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Xp = 0,
            Streak = 0,
            Hearts = 0,
            MaxHearts = 0,
            CompletedLessonsJson = "{}",
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        _dbContext.MiniAppUserProgresses.Add(progress);
        return progress;
    }

    private static Dictionary<string, List<int>> ParseCompletedLessons(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json) ?? new();
        }
        catch
        {
            return new();
        }
    }

    private static object SerializeProgress(MiniAppUserProgress progress)
    {
        var completed = ParseCompletedLessons(progress.CompletedLessonsJson);
        return new
        {
            xp = progress.Xp,
            streak = progress.Streak,
            lastPlayedAtUtc = progress.LastPlayedAtUtc,
            completedLessons = completed
        };
    }

    [HttpGet("vocabulary")]
    public async Task<IActionResult> GetVocabulary(CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user == null)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        var entries = await _dbContext.VocabularyEntries
            .Where(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage)
            .OrderByDescending(v => v.DateAddedUtc)
            .ToListAsync(ct);

        var items = entries.Select(e => new
        {
            id = e.Id.ToString(),
            word = e.Word,
            definition = e.Definition,
            example = e.Example,
            dateAddedUtc = e.DateAddedUtc,
            successCount = e.SuccessAnswersCount,
            successReverseCount = e.SuccessAnswersCountInReverseDirection,
            failedCount = e.FailedAnswersCount,
            mastery = e.GetMasteringLevel().ToString(),
            isStarter = false
        }).ToList<object>();

        // If user's own vocabulary is empty, offer starter words so they can start practicing immediately.
        var starters = _content.GetStarterVocabulary()
            .Select(s => new
            {
                id = "starter-" + s.Word,
                word = s.Word,
                definition = s.Definition,
                example = s.Example,
                dateAddedUtc = (DateTime?)null,
                successCount = 0,
                successReverseCount = 0,
                failedCount = 0,
                mastery = MasteringLevel.NotMastered.ToString(),
                isStarter = true
            })
            .ToList<object>();

        return Ok(new
        {
            language = user.Settings.CurrentLanguage.ToString(),
            items,
            starterItems = items.Count == 0 ? starters : new List<object>()
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

        var random = new Random();
        var requested = Math.Clamp(request.Count <= 0 ? 10 : request.Count, 1, MaxVocabularyQuizQuestions);

        var allEntries = await _dbContext.VocabularyEntries
            .Where(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage)
            .ToListAsync(ct);

        // Fallback path: user has no vocabulary — use starter words (no DB writes for these)
        if (allEntries.Count == 0 || request.Mode == "starter")
        {
            var starter = _content.GetStarterVocabulary();
            if (starter.Count == 0)
            {
                return Ok(new { questions = Array.Empty<object>() });
            }

            var selectedStarter = starter.OrderBy(_ => random.Next()).Take(requested).ToList();
            var questions = selectedStarter.Select(entry =>
            {
                var questionText = $"Переведи «{entry.Definition}» на грузинский";
                var correct = entry.Word;

                var distractors = starter
                    .Where(s => s.Word != entry.Word)
                    .Select(s => s.Word)
                    .Distinct()
                    .OrderBy(_ => random.Next())
                    .Take(3)
                    .ToList();

                var options = distractors.Append(correct).OrderBy(_ => random.Next()).ToList();
                var answerIndex = options.IndexOf(correct);

                return new
                {
                    id = "starter-" + entry.Word,
                    wordId = (Guid?)null,
                    lemma = entry.Word,
                    question = questionText,
                    options,
                    answerIndex,
                    explanation = string.IsNullOrWhiteSpace(entry.Example) ? string.Empty : entry.Example,
                    direction = "ru-to-ge",
                    isStarter = true
                };
            }).ToList();

            return Ok(new { questions });
        }

        var pool = request.Mode switch
        {
            "all" => allEntries.ToList(),
            "new" => allEntries.Where(e => e.SuccessAnswersCount == 0 && e.SuccessAnswersCountInReverseDirection == 0 && e.FailedAnswersCount == 0).ToList(),
            "weak" => allEntries
                .Where(e => e.GetMasteringLevel() != MasteringLevel.MasteredInBothDirections)
                .OrderByDescending(e => e.FailedAnswersCount)
                .ThenBy(e => e.SuccessAnswersCount + e.SuccessAnswersCountInReverseDirection)
                .ToList(),
            _ when request.WordIds.Count > 0 => allEntries.Where(e => request.WordIds.Contains(e.Id)).ToList(),
            _ => allEntries.ToList()
        };

        if (pool.Count == 0)
        {
            return Ok(new { questions = Array.Empty<object>() });
        }

        var selected = pool.OrderBy(_ => random.Next()).Take(requested).ToList();

        // Distractors come from user's other words first, topped up with the starter set
        // so tiny vocabularies still get a meaningful multi-choice.
        var starterWords = _content.GetStarterVocabulary().Select(s => s.Word).ToList();

        var userQuestions = selected.Select(entry =>
        {
            var (georgian, russian) = GetSides(entry);
            var questionText = $"Переведи «{russian}» на грузинский";
            var correct = georgian;

            var distractorPool = allEntries
                .Where(e => e.Id != entry.Id)
                .Select(e => GetSides(e).georgian)
                .Concat(starterWords)
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .Distinct()
                .Where(s => s != correct)
                .ToList();

            var distractors = distractorPool.OrderBy(_ => random.Next()).Take(3).ToList();
            while (distractors.Count < 3) distractors.Add("—");

            var options = distractors.Append(correct).OrderBy(_ => random.Next()).ToList();
            var answerIndex = options.IndexOf(correct);

            return new
            {
                id = entry.Id.ToString(),
                wordId = (Guid?)entry.Id,
                lemma = georgian,
                question = questionText,
                options,
                answerIndex,
                explanation = string.IsNullOrWhiteSpace(entry.Example) ? string.Empty : entry.Example,
                direction = "ru-to-ge",
                isStarter = false
            };
        }).ToList();

        // Word pairs + distractor pools for frontend-built rounds
        // (GE→RU multi-choice, type-in both directions)
        var wordPairs = selected.Select(entry =>
        {
            var (ge, ru) = GetSides(entry);
            return new
            {
                wordId = entry.Id,
                georgian = ge,
                russian = ru
            };
        }).ToList();

        var allGeorgian = allEntries
            .Select(e => GetSides(e).georgian)
            .Concat(starterWords)
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Distinct()
            .ToList();

        var starterRussian = _content.GetStarterVocabulary().Select(s => s.Definition).ToList();
        var allRussian = allEntries
            .Select(e => GetSides(e).russian)
            .Concat(starterRussian)
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Distinct()
            .ToList();

        return Ok(new
        {
            questions = userQuestions,
            wordPairs,
            allGeorgian,
            allRussian
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

        // Starter words have no WordId — nothing to persist, just ack.
        if (request.WordId == null || request.WordId == Guid.Empty)
        {
            return Ok(new { skipped = true });
        }

        var entry = await _dbContext.VocabularyEntries
            .FirstOrDefaultAsync(v => v.Id == request.WordId.Value && v.UserId == user.Id, ct);

        if (entry == null)
        {
            return NotFound();
        }

        if (request.Correct)
        {
            // The quiz always asks the learner to produce the Georgian side.
            // Whether that maps to Word or Definition depends on how the entry
            // was originally stored, so match TraleBot's ScorePoint semantics:
            //   answer == Definition → SuccessAnswersCount++
            //   answer == Word        → SuccessAnswersCountInReverseDirection++
            var (georgian, _) = GetSides(entry);
            if (string.Equals(georgian, entry.Definition, StringComparison.InvariantCultureIgnoreCase))
            {
                entry.SuccessAnswersCount++;
            }
            else
            {
                entry.SuccessAnswersCountInReverseDirection++;
            }
        }
        else
        {
            entry.FailedAnswersCount++;
        }
        entry.UpdatedAtUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        return Ok(new
        {
            id = entry.Id,
            successCount = entry.SuccessAnswersCount,
            successReverseCount = entry.SuccessAnswersCountInReverseDirection,
            failedCount = entry.FailedAnswersCount,
            mastery = entry.GetMasteringLevel().ToString()
        });
    }

    private static bool ContainsGeorgian(string s)
    {
        if (string.IsNullOrEmpty(s)) return false;
        foreach (var c in s)
        {
            if (c >= 0x10A0 && c <= 0x10FF) return true;
        }
        return false;
    }

    /// <summary>
    /// Returns (georgian, russian) sides of a vocabulary entry regardless of
    /// which column holds which language — VocabularyEntry stores the user's
    /// input direction, so Word can be either GE or RU.
    /// </summary>
    private static (string georgian, string russian) GetSides(VocabularyEntry e)
    {
        if (ContainsGeorgian(e.Word))
        {
            return (e.Word, e.Definition);
        }
        return (e.Definition, e.Word);
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
