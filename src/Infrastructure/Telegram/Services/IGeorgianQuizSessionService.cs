namespace Infrastructure.Telegram.Services;

public interface IGeorgianQuizSessionService
{
    Task StartQuizSessionAsync(long userId, int lessonId, List<QuizQuestionData> questions);
    Task<GeorgianQuizSessionState?> GetSessionAsync(long userId);
    Task UpdateSessionAsync(GeorgianQuizSessionState state);
    Task EndSessionAsync(long userId);
    Task<bool> HasActiveSessionAsync(long userId);
    
    // Synchronous overloads for backward compatibility
    GeorgianQuizSessionState? GetSession(long userId);
}