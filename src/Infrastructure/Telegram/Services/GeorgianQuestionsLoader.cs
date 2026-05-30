using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Telegram.Services;

public class GeorgianQuestionsLoader : IGeorgianQuestionsLoader
{
    private readonly string _questionsFilePath;
    private List<QuizQuestionData>? _cachedQuestions;
    private readonly ILogger<GeorgianQuestionsLoader> _logger;
    private readonly string _fileName;

    public GeorgianQuestionsLoader(ILogger<GeorgianQuestionsLoader> logger, string fileName = "questions.json", string subdirectory = "Lessons/GeorgianVerbsOfMovement")
    {
        _logger = logger;
        _fileName = fileName;

        // Try to find questions file in multiple locations
        var contentRoots = new[]
        {
            Path.Combine(AppContext.BaseDirectory, subdirectory, _fileName),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "Trale", subdirectory, _fileName),
            Path.Combine(Environment.CurrentDirectory, subdirectory, _fileName),
            Path.Combine(Environment.CurrentDirectory, "..", "..", "Trale", subdirectory, _fileName),
            Path.Combine(AppContext.BaseDirectory, "src", "Trale", subdirectory, _fileName),
        };

        _questionsFilePath = contentRoots.FirstOrDefault(File.Exists) ?? _fileName;
        
        _logger.LogInformation("Questions loader initialized with file {FileName}. Path: {Path}, Exists: {Exists}", 
            _fileName, _questionsFilePath, File.Exists(_questionsFilePath));
    }

    public List<QuizQuestionData> LoadQuestions()
    {
        if (_cachedQuestions == null)
        {
            _cachedQuestions = LoadAllQuestions();
        }

        var random = Random.Shared;
        var shuffled = _cachedQuestions.OrderBy(_ => random.Next()).ToList();
        
        // Возвращаем 12 случайных вопросов
        var selectedQuestions = shuffled.Take(12).ToList();
        
        // Shuffle answer options for each question
        foreach (var question in selectedQuestions)
        {
            question.ShuffleOptions(random);
        }
        
        return selectedQuestions;
    }

    private List<QuizQuestionData> LoadAllQuestions()
    {
        try
        {
            if (!File.Exists(_questionsFilePath))
            {
                _logger.LogWarning("Questions file {FileName} not found at: {Path}", _fileName, _questionsFilePath);
                _logger.LogWarning("Current directory: {CurrentDirectory}, Base directory: {BaseDirectory}", 
                    Environment.CurrentDirectory, AppContext.BaseDirectory);
                return new();
            }

            var json = File.ReadAllText(_questionsFilePath);
            
            // Parse JSON with comment handling enabled
            var jsonOptions = new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip };
            using var document = JsonDocument.Parse(json, jsonOptions);
            var root = document.RootElement;

            var questions = new List<QuizQuestionData>();

            if (root.TryGetProperty("questions", out var questionsArray))
            {
                foreach (var questionElement in questionsArray.EnumerateArray())
                {
                    var question = new QuizQuestionData
                    {
                        Id = questionElement.GetProperty("id").GetString() ?? string.Empty,
                        Lemma = questionElement.TryGetProperty("lemma", out var lm) ? lm.GetString() ?? string.Empty : string.Empty,
                        Question = questionElement.TryGetProperty("question", out var q) ? q.GetString() ?? string.Empty
                                 : questionElement.TryGetProperty("prompt", out var p) ? p.GetString() ?? string.Empty : string.Empty,
                        Explanation = questionElement.TryGetProperty("explanation", out var e) ? e.GetString() ?? string.Empty : string.Empty,
                        AnswerIndex = questionElement.TryGetProperty("answer_index", out var ai) ? ai.GetInt32() : 0,
                        Options = new(),
                        Tags = new()
                    };

                    if (questionElement.TryGetProperty("options", out var optionsArray))
                    {
                        foreach (var option in optionsArray.EnumerateArray())
                        {
                            question.Options.Add(option.GetString() ?? string.Empty);
                        }
                    }

                    if (questionElement.TryGetProperty("question_type", out var qt)
                        || questionElement.TryGetProperty("questionType", out qt))
                    {
                        question.QuestionType = qt.GetString();
                    }

                    if (questionElement.TryGetProperty("audio_url", out var au))
                    {
                        question.AudioUrl = au.GetString();
                    }

                    if (questionElement.TryGetProperty("transcript", out var tr))
                    {
                        question.Transcript = tr.GetString();
                    }

                    if (questionElement.TryGetProperty("tags", out var tagsArray) && tagsArray.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var tag in tagsArray.EnumerateArray())
                        {
                            var tagStr = tag.GetString();
                            if (!string.IsNullOrWhiteSpace(tagStr))
                            {
                                question.Tags.Add(tagStr!);
                            }
                        }
                    }

                    if (question.QuestionType == "sentence-builder")
                    {
                        var sb = ParseSentenceBuilder(questionElement, question.Id);
                        if (sb == null)
                            continue; // validation failed — skip this question
                        question.SentenceBuilder = sb;
                    }

                    questions.Add(question);
                }
            }

            _logger.LogInformation("Loaded {QuestionCount} questions from {Path}", questions.Count, _questionsFilePath);
            return questions;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading questions from {Path}", _questionsFilePath);
            return new();
        }
    }

    private SentenceBuilderQuestion? ParseSentenceBuilder(JsonElement el, string questionId)
    {
        var sb = new SentenceBuilderQuestion();

        if (el.TryGetProperty("targetSentence", out var ts) && ts.TryGetProperty("ru", out var ru))
            sb.TargetSentence = new TargetSentenceData(ru.GetString() ?? string.Empty);

        if (el.TryGetProperty("level", out var lvl))
            sb.Level = lvl.GetInt32();

        if (el.TryGetProperty("correctOrder", out var co) && co.ValueKind == JsonValueKind.Array)
            sb.CorrectOrder = co.EnumerateArray().Select(t => t.GetString() ?? string.Empty).ToList();

        if (el.TryGetProperty("chipPool", out var cp) && cp.ValueKind == JsonValueKind.Array)
            sb.ChipPool = cp.EnumerateArray().Select(t => t.GetString() ?? string.Empty).ToList();

        if (el.TryGetProperty("presetPositions", out var pp) && pp.ValueKind == JsonValueKind.Array)
        {
            foreach (var pos in pp.EnumerateArray())
            {
                if (pos.TryGetProperty("position", out var p) && pos.TryGetProperty("token", out var tok))
                    sb.PresetPositions.Add(new PresetPosition(p.GetInt32(), tok.GetString() ?? string.Empty));
            }
        }

        if (el.TryGetProperty("hints", out var hints) && hints.ValueKind == JsonValueKind.Object)
        {
            foreach (var hint in hints.EnumerateObject())
                sb.Hints[hint.Name] = hint.Value.GetString() ?? string.Empty;
        }

        if (el.TryGetProperty("alternativeAnswers", out var altAnswers) && altAnswers.ValueKind == JsonValueKind.Array)
        {
            sb.AlternativeAnswers = altAnswers.EnumerateArray()
                .Where(inner => inner.ValueKind == JsonValueKind.Array)
                .Select(inner => inner.EnumerateArray()
                    .Select(t => t.GetString() ?? string.Empty)
                    .ToList())
                .ToList();
        }

        var chipSet = new HashSet<string>(sb.ChipPool);
        var missingTokens = sb.CorrectOrder.Where(t => !chipSet.Contains(t)).ToList();
        if (missingTokens.Count > 0)
        {
            _logger.LogWarning(
                "Question {QuestionId} skipped: tokens [{Tokens}] in correctOrder are absent from chipPool",
                questionId, string.Join(", ", missingTokens));
            return null;
        }

        return sb;
    }
}