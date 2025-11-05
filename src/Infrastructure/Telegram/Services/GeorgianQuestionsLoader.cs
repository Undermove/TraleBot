using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Telegram.Services;

public class GeorgianQuestionsLoader : IGeorgianQuestionsLoader
{
    private readonly string _questionsFilePath;
    private List<QuizQuestionData>? _cachedQuestions;
    private readonly ILogger<GeorgianQuestionsLoader> _logger;

    public GeorgianQuestionsLoader(ILogger<GeorgianQuestionsLoader> logger)
    {
        _logger = logger;
        
        // Try to find questions.json in multiple locations
        var contentRoots = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "questions.json"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "Trale", "questions.json"),
            Path.Combine(Environment.CurrentDirectory, "questions.json"),
            Path.Combine(Environment.CurrentDirectory, "..", "..", "Trale", "questions.json"),
            Path.Combine(AppContext.BaseDirectory, "src", "Trale", "questions.json"),
        };

        _questionsFilePath = contentRoots.FirstOrDefault(File.Exists) ?? "questions.json";
        
        _logger.LogInformation("Questions loader initialized. Path: {Path}, Exists: {Exists}", 
            _questionsFilePath, File.Exists(_questionsFilePath));
    }

    public List<QuizQuestionData> LoadQuestionsForLesson(int lessonId)
    {
        if (_cachedQuestions == null)
        {
            _cachedQuestions = LoadAllQuestions();
        }

        var random = new Random();
        var shuffled = _cachedQuestions.OrderBy(_ => random.Next()).ToList();
        
        // Возвращаем 12 случайных вопросов
        return shuffled.Take(12).ToList();
    }

    private List<QuizQuestionData> LoadAllQuestions()
    {
        try
        {
            if (!File.Exists(_questionsFilePath))
            {
                _logger.LogWarning("Questions file not found at: {Path}", _questionsFilePath);
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
                        Explanation = questionElement.GetProperty("explanation").GetString() ?? string.Empty,
                        AnswerIndex = questionElement.GetProperty("answer_index").GetInt32(),
                        Options = new()
                    };

                    if (questionElement.TryGetProperty("options", out var optionsArray))
                    {
                        foreach (var option in optionsArray.EnumerateArray())
                        {
                            question.Options.Add(option.GetString() ?? string.Empty);
                        }
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
}