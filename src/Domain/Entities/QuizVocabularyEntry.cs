namespace Domain.Entities;

public class QuizVocabularyEntry
{
    public Guid QuizId { get; set; }
    public Quiz Quiz { get; set; }
    public Guid VocabularyEntryId { get; set; }
    public VocabularyEntry VocabularyEntry { get; set; }
}