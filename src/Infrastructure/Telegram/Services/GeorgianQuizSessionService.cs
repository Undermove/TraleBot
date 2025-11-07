using System.Text.Json;
using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using Infrastructure.Telegram.Services;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Infrastructure.Telegram.Services;

public class GeorgianQuizSessionService : IGeorgianQuizSessionService
{
    private readonly ITraleDbContext _dbContext;

    public GeorgianQuizSessionService(ITraleDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task StartQuizSessionAsync(long telegramUserId, int lessonId, List<QuizQuestionData> questions)
    {
        // Get User by TelegramId
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.TelegramId == telegramUserId);
        
        if (user == null)
            return;

        // Delete any existing session for this user
        var existingSession = await _dbContext.GeorgianQuizSessions
            .FirstOrDefaultAsync(s => s.TelegramUserId == telegramUserId);
        
        if (existingSession != null)
        {
            _dbContext.GeorgianQuizSessions.Remove(existingSession);
        }

        var questionsJson = JsonSerializer.Serialize(questions);
        var now = DateTime.UtcNow;
        
        var session = new GeorgianQuizSession
        {
            Id = Guid.NewGuid(),
            TelegramUserId = telegramUserId,
            UserId = user.Id,
            LessonId = lessonId,
            QuestionsJson = questionsJson,
            CurrentQuestionIndex = 0,
            CorrectAnswersCount = 0,
            IncorrectAnswersCount = 0,
            WeakVerbsJson = "[]",
            StartedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _dbContext.GeorgianQuizSessions.Add(session);
        await _dbContext.SaveChangesAsync(CancellationToken.None);
    }

    public async Task<GeorgianQuizSessionState?> GetSessionAsync(long telegramUserId)
    {
        var session = await _dbContext.GeorgianQuizSessions
            .FirstOrDefaultAsync(s => s.TelegramUserId == telegramUserId);
        
        if (session == null)
            return null;

        return MapToState(session);
    }

    public GeorgianQuizSessionState? GetSession(long telegramUserId)
    {
        var session = _dbContext.GeorgianQuizSessions
            .FirstOrDefault(s => s.TelegramUserId == telegramUserId);
        
        if (session == null)
            return null;

        return MapToState(session);
    }

    public async Task UpdateSessionAsync(GeorgianQuizSessionState state)
    {
        var session = await _dbContext.GeorgianQuizSessions
            .FirstOrDefaultAsync(s => s.TelegramUserId == state.UserId);
        
        if (session == null)
            return;

        session.CurrentQuestionIndex = state.CurrentQuestionIndex;
        session.CorrectAnswersCount = state.CorrectAnswersCount;
        session.IncorrectAnswersCount = state.IncorrectAnswersCount;
        // Persist only weak verbs (lemmas)
        session.WeakVerbsJson = JsonSerializer.Serialize(state.WeakVerbs);
        session.UpdatedAtUtc = DateTime.UtcNow;

        _dbContext.GeorgianQuizSessions.Update(session);
        await _dbContext.SaveChangesAsync(CancellationToken.None);
    }

    public async Task EndSessionAsync(long telegramUserId)
    {
        var session = await _dbContext.GeorgianQuizSessions
            .FirstOrDefaultAsync(s => s.TelegramUserId == telegramUserId);
        
        if (session != null)
        {
            _dbContext.GeorgianQuizSessions.Remove(session);
            await _dbContext.SaveChangesAsync(CancellationToken.None);
        }
    }

    public async Task<bool> HasActiveSessionAsync(long telegramUserId)
    {
        return await _dbContext.GeorgianQuizSessions.AnyAsync(s => s.TelegramUserId == telegramUserId);
    }

    private static GeorgianQuizSessionState MapToState(GeorgianQuizSession session)
    {
        var questions = new List<QuizQuestionData>();
        
        try
        {
            questions = JsonSerializer.Deserialize<List<QuizQuestionData>>(session.QuestionsJson) 
                ?? new List<QuizQuestionData>();
        }
        catch
        {
            // If deserialization fails, return empty list
        }

        var weakVerbs = new List<string>();
        
        try
        {
            weakVerbs = JsonSerializer.Deserialize<List<string>>(session.WeakVerbsJson) 
                ?? new List<string>();
        }
        catch
        {
            // If deserialization fails, return empty list
        }

        return new GeorgianQuizSessionState
        {
            UserId = session.TelegramUserId,
            LessonId = session.LessonId,
            Questions = questions,
            CurrentQuestionIndex = session.CurrentQuestionIndex,
            CorrectAnswersCount = session.CorrectAnswersCount,
            IncorrectAnswersCount = session.IncorrectAnswersCount,
            WeakVerbs = weakVerbs,
            StartedAt = session.StartedAtUtc,
            QuizFeedbackText = string.Empty
        };
    }
}