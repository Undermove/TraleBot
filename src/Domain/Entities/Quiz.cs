namespace Domain.Entities;

public abstract class Quiz
{
    public Guid Id { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime DateStarted { get; set; }
    public int CorrectAnswersCount { get; set; }
    public int IncorrectAnswersCount { get; set; }

    public Guid UserId { get; set; }
    public virtual User User { get; set; }
    public virtual List<QuizQuestion> QuizQuestions { get; set; } = null!;
    public Guid ShareableQuizId { get; set; }
    public virtual ShareableQuiz? ShareableQuiz { get; set; }

    public void ScorePoint(bool isAnswerCorrect)
    {
        if (isAnswerCorrect)
        {
            CorrectAnswersCount++;
        }
        else
        {
            IncorrectAnswersCount++;
        }
    }

    public double GetCorrectnessPercent() => 
        Math.Round(100 * (CorrectAnswersCount / (IncorrectAnswersCount + (double)CorrectAnswersCount)), 0);
}