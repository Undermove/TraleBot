namespace Domain.Entities;

public class QuizQuestion
{
    public required Guid Id { get; set; }
    public required string Question { get; set; }
    public required string Answer { get; set; }
    public required string Example { get; set; }
    
    public Guid VocabularyEntryId { get; set; }
    public VocabularyEntry VocabularyEntry { get; set; }
}