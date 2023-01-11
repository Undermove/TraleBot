namespace Domain.Entities;

public class Quiz
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ICollection<VocabularyEntry> VocabularyEntriesQueue { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime DateStarted { get; set; }
}