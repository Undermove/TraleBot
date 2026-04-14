using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Queries;

public class GenerateVocabularyQuiz : IRequest<GenerateVocabularyQuizResult>
{
    public required Guid UserId { get; init; }
    public List<Guid> WordIds { get; init; } = new();
    public string Mode { get; init; } = "custom";
    public int Count { get; init; } = 10;

    public class Handler(
        ITraleDbContext dbContext,
        IMiniAppContentProvider content)
        : IRequestHandler<GenerateVocabularyQuiz, GenerateVocabularyQuizResult>
    {
        public async Task<GenerateVocabularyQuizResult> Handle(GenerateVocabularyQuiz request, CancellationToken ct)
        {
            var user = await dbContext.Users
                .Include(u => u.Settings)
                .FirstOrDefaultAsync(u => u.Id == request.UserId, ct);

            if (user == null)
            {
                return GenerateVocabularyQuizResult.Empty();
            }

            var random = new Random();
            var requested = Math.Clamp(
                request.Count <= 0 ? 10 : request.Count, 1,
                LearningConstants.Quiz.MaxVocabularyQuestions);

            var allEntries = await dbContext.VocabularyEntries
                .Where(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage)
                .ToListAsync(ct);

            // Fallback path: user has no vocabulary — use starter words
            if (allEntries.Count == 0 || request.Mode == "starter")
            {
                return BuildStarterQuiz(random, requested);
            }

            var pool = request.Mode switch
            {
                "all" => allEntries.ToList(),
                "new" => allEntries
                    .Where(e => e.SuccessAnswersCount == 0 &&
                                e.SuccessAnswersCountInReverseDirection == 0 &&
                                e.FailedAnswersCount == 0)
                    .ToList(),
                "weak" => allEntries
                    .Where(e => e.GetMasteringLevel() != MasteringLevel.MasteredInBothDirections)
                    .OrderByDescending(e => e.FailedAnswersCount)
                    .ThenBy(e => e.SuccessAnswersCount + e.SuccessAnswersCountInReverseDirection)
                    .ToList(),
                _ when request.WordIds.Count > 0 => allEntries
                    .Where(e => request.WordIds.Contains(e.Id))
                    .ToList(),
                _ => allEntries.ToList()
            };

            if (pool.Count == 0)
            {
                return GenerateVocabularyQuizResult.Empty();
            }

            var selected = pool.OrderBy(_ => random.Next()).Take(requested).ToList();
            var starterWords = content.GetStarterVocabulary().Select(s => s.Word).ToList();

            var questions = selected.Select(entry =>
            {
                var (georgian, russian) = MiniAppHelpers.GetSides(entry);
                var questionText = $"Переведи «{russian}» на грузинский";
                var correct = georgian;

                var distractorPool = allEntries
                    .Where(e => e.Id != entry.Id)
                    .Select(e => MiniAppHelpers.GetSides(e).georgian)
                    .Concat(starterWords)
                    .Where(w => !string.IsNullOrWhiteSpace(w))
                    .Distinct()
                    .Where(s => s != correct)
                    .ToList();

                var distractors = distractorPool.OrderBy(_ => random.Next()).Take(3).ToList();
                while (distractors.Count < 3) distractors.Add("—");

                var options = distractors.Append(correct).OrderBy(_ => random.Next()).ToList();
                var answerIndex = options.IndexOf(correct);

                return new QuizQuestionDto
                {
                    Id = entry.Id.ToString(),
                    WordId = entry.Id,
                    Lemma = georgian,
                    Question = questionText,
                    Options = options,
                    AnswerIndex = answerIndex,
                    Explanation = string.IsNullOrWhiteSpace(entry.Example)
                        ? string.Empty
                        : entry.Example,
                    Direction = "ru-to-ge",
                    IsStarter = false
                };
            }).ToList();

            var wordPairs = selected.Select(entry =>
            {
                var (ge, ru) = MiniAppHelpers.GetSides(entry);
                return new WordPairDto
                {
                    WordId = entry.Id,
                    Georgian = ge,
                    Russian = ru
                };
            }).ToList();

            var allGeorgian = allEntries
                .Select(e => MiniAppHelpers.GetSides(e).georgian)
                .Concat(starterWords)
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .Distinct()
                .ToList();

            var starterRussian = content.GetStarterVocabulary().Select(s => s.Definition).ToList();
            var allRussian = allEntries
                .Select(e => MiniAppHelpers.GetSides(e).russian)
                .Concat(starterRussian)
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .Distinct()
                .ToList();

            return new GenerateVocabularyQuizResult
            {
                Questions = questions,
                WordPairs = wordPairs,
                AllGeorgian = allGeorgian,
                AllRussian = allRussian
            };
        }

        private GenerateVocabularyQuizResult BuildStarterQuiz(Random random, int requested)
        {
            var starter = content.GetStarterVocabulary();
            if (starter.Count == 0)
            {
                return GenerateVocabularyQuizResult.Empty();
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

                return new QuizQuestionDto
                {
                    Id = "starter-" + entry.Word,
                    WordId = null,
                    Lemma = entry.Word,
                    Question = questionText,
                    Options = options,
                    AnswerIndex = answerIndex,
                    Explanation = string.IsNullOrWhiteSpace(entry.Example)
                        ? string.Empty
                        : entry.Example,
                    Direction = "ru-to-ge",
                    IsStarter = true
                };
            }).ToList();

            return new GenerateVocabularyQuizResult
            {
                Questions = questions,
                WordPairs = new List<WordPairDto>(),
                AllGeorgian = new List<string>(),
                AllRussian = new List<string>()
            };
        }
    }
}

public class GenerateVocabularyQuizResult
{
    public List<QuizQuestionDto> Questions { get; init; } = new();
    public List<WordPairDto> WordPairs { get; init; } = new();
    public List<string> AllGeorgian { get; init; } = new();
    public List<string> AllRussian { get; init; } = new();

    public static GenerateVocabularyQuizResult Empty() => new()
    {
        Questions = new List<QuizQuestionDto>(),
        WordPairs = new List<WordPairDto>(),
        AllGeorgian = new List<string>(),
        AllRussian = new List<string>()
    };
}

public class QuizQuestionDto
{
    public string Id { get; init; }
    public Guid? WordId { get; init; }
    public string Lemma { get; init; }
    public string Question { get; init; }
    public List<string> Options { get; init; }
    public int AnswerIndex { get; init; }
    public string Explanation { get; init; }
    public string Direction { get; init; }
    public bool IsStarter { get; init; }
}

public class WordPairDto
{
    public Guid WordId { get; init; }
    public string Georgian { get; init; }
    public string Russian { get; init; }
}
