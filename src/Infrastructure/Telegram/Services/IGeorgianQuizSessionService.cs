namespace Infrastructure.Telegram.Services;

public interface IGeorgianQuizSessionService
{
    void StartQuizSession(long userId, int lessonId, List<QuizQuestionData> questions);
    GeorgianQuizSessionState? GetSession(long userId);
    void UpdateSession(GeorgianQuizSessionState state);
    void EndSession(long userId);
    bool HasActiveSession(long userId);
}