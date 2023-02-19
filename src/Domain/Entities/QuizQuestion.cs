namespace Domain.Entities;

public class QuizQuestion
{
    public Guid Id { get; set; }
    public string Question { get; set; }
    public string Answer { get; set; }
    
    public Guid VocabularyEntryId { get; set; }
    public VocabularyEntry VocabularyEntry { get; set; }
}