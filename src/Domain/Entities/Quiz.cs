namespace Domain.Entities;

public class Quiz
{
    public Guid Id { get; set; }
    public ICollection<VocabularyEntry> VocabularyEntries { get; set; } = null!;
    public bool IsCompleted { get; set; }
    public DateTime DateStarted { get; set; }
    
    public Guid UserId { get; set; }
    public User User { get; set; }
}