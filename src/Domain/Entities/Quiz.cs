namespace Domain.Entities;

public class Quiz
{
    public Guid Id { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime DateStarted { get; set; }
    
    public Guid UserId { get; set; }
    public User User { get; set; }
    public IList<QuizVocabularyEntry> QuizVocabularyEntries { get; set; } = null!;
}