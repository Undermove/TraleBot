namespace Domain.Entities;

public class ShareableQuiz
{
    public required Guid Id { get; set; }
    public required QuizTypes QuizType { get; set; }
    public required DateTime DateAddedUtc { get; set; }
    public required Guid CreatedByUserId { get; set; }
    public virtual User CreatedByUser { get; set; } = null!;
    public virtual ICollection<VocabularyEntry> VocabularyEntries { get; set; } = null!;
}