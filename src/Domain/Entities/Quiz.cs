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

public class QuizVocabularyEntry
{
    public Guid QuizId { get; set; }
    public Quiz Quiz { get; set; }
    public Guid VocabularyEntryId { get; set; }
    public VocabularyEntry VocabularyEntry { get; set; }
}