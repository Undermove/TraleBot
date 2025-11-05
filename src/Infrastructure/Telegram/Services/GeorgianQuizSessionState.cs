namespace Infrastructure.Telegram.Services;

public class GeorgianQuizSessionState
{
    public long UserId { get; set; }
    public int LessonId { get; set; }
    public List<QuizQuestionData> Questions { get; set; } = new();
    public int CurrentQuestionIndex { get; set; }
    public int CorrectAnswersCount { get; set; }
    public int IncorrectAnswersCount { get; set; }
    public List<string> WeakVerbs { get; set; } = new();
    public DateTime StartedAt { get; set; }
    public string QuizFeedbackText { get; set; } = string.Empty;
}

public class QuizQuestionData
{
    public string Id { get; set; } = string.Empty;
    public string Lemma { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public int AnswerIndex { get; set; }
    public string Explanation { get; set; } = string.Empty;
}