namespace Domain.Entities;

public class Quiz
{
    public Guid Id { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime DateStarted { get; set; }
    public int CorrectAnswersCount { get; set; }
    public int IncorrectAnswersCount { get; set; }
    
    public Guid UserId { get; set; }
    public User User { get; set; }
    public IList<QuizVocabularyEntry> QuizVocabularyEntries { get; set; } = null!;
    public ICollection<QuizQuestion> QuizQuestions { get; set; } = null!;
    
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
}