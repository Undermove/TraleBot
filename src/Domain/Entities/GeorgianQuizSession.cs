// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
#pragma warning disable CS8618

using System.Text.Json;

namespace Domain.Entities;

public class GeorgianQuizSession
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Telegram User ID (long) - used to track sessions by telegram id
    /// </summary>
    public long TelegramUserId { get; set; }
    
    /// <summary>
    /// Foreign key to User entity
    /// </summary>
    public Guid UserId { get; set; }
    
    public int LessonId { get; set; }
    
    /// <summary>
    /// JSON serialized list of QuizQuestionData objects
    /// </summary>
    public string QuestionsJson { get; set; }
    
    public int CurrentQuestionIndex { get; set; }
    public int CorrectAnswersCount { get; set; }
    public int IncorrectAnswersCount { get; set; }
    
    /// <summary>
    /// JSON array of weak verbs
    /// </summary>
    public string WeakVerbsJson { get; set; } = "[]";
    
    public DateTime StartedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    
    public virtual User? User { get; set; }
}