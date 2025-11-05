namespace Infrastructure.Telegram.Services;

public class GeorgianQuizSessionService : IGeorgianQuizSessionService
{
    private readonly Dictionary<long, GeorgianQuizSessionState> _sessions = new();

    public void StartQuizSession(long userId, int lessonId, List<QuizQuestionData> questions)
    {
        _sessions[userId] = new GeorgianQuizSessionState
        {
            UserId = userId,
            LessonId = lessonId,
            Questions = questions,
            CurrentQuestionIndex = 0,
            CorrectAnswersCount = 0,
            IncorrectAnswersCount = 0,
            WeakVerbs = new(),
            StartedAt = DateTime.UtcNow
        };
    }

    public GeorgianQuizSessionState? GetSession(long userId)
    {
        return _sessions.TryGetValue(userId, out var session) ? session : null;
    }

    public void UpdateSession(GeorgianQuizSessionState state)
    {
        _sessions[state.UserId] = state;
    }

    public void EndSession(long userId)
    {
        _sessions.Remove(userId);
    }

    public bool HasActiveSession(long userId)
    {
        return _sessions.ContainsKey(userId);
    }
}