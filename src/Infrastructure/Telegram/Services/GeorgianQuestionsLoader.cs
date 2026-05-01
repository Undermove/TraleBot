using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Telegram.Services;

public class GeorgianQuestionsLoader : IGeorgianQuestionsLoader
{
    private const int QuestionsPerLesson = 12;

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

    public List<QuizQuestionData> LoadQuestionsForLesson(int lessonId)
    {
        if (_cachedQuestions == null)
        {
            _cachedQuestions = LoadAllQuestions();
        }

        var random = Random.Shared;
        var shuffled = _cachedQuestions.OrderBy(_ => random.Next()).ToList();
        var selectedQuestions = shuffled.Take(QuestionsPerLesson).ToList();
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
                        Lemma = questionElement.GetProperty("lemma").GetString() ?? string.Empty,
                        Question = questionElement.TryGetProperty("question", out var q) ? q.GetString() ?? string.Empty 
                                 : questionElement.TryGetProperty("prompt", out var p) ? p.GetString() ?? string.Empty : string.Empty,
                        Explanation = questionElement.TryGetProperty("explanation", out var e) ? e.GetString() ?? string.Empty : string.Empty,
                        AnswerIndex = questionElement.GetProperty("answer_index").GetInt32(),
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

                    if (questionElement.TryGetProperty("question_type", out var qt))
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

                    if (questionElement.TryGetProperty("target_sentence", out var ts) && ts.TryGetProperty("ru", out var tsRu))
                        question.TargetSentenceRu = tsRu.GetString();

                    if (questionElement.TryGetProperty("correct_order", out var co) && co.ValueKind == JsonValueKind.Array)
                        question.CorrectOrder = co.EnumerateArray().Select(e => e.GetString() ?? string.Empty).ToList();

                    if (questionElement.TryGetProperty("chip_pool", out var cp) && cp.ValueKind == JsonValueKind.Array)
                        question.ChipPool = cp.EnumerateArray().Select(e => e.GetString() ?? string.Empty).ToList();

                    if (questionElement.TryGetProperty("preset_positions", out var pp) && pp.ValueKind == JsonValueKind.Array)
                        question.PresetPositions = pp.EnumerateArray()
                            .Select(e => new SentenceBuilderPreset(
                                e.GetProperty("position").GetInt32(),
                                e.GetProperty("token").GetString() ?? string.Empty))
                            .ToList();

                    if (questionElement.TryGetProperty("hints", out var hints) && hints.ValueKind == JsonValueKind.Object)
                        question.Hints = hints.EnumerateObject()
                            .ToDictionary(p => p.Name, p => p.Value.GetString() ?? string.Empty);

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
}