namespace Domain.Entities;

public class ShareableQuiz
{
    public required Guid Id { get; set; }
    public required QuizTypes QuizType { get; set; }
    public required DateTime DateAddedUtc { get; set; }
    public required Guid CreatedByUserId { get; set; }
    public required string CreatedByUserName { get; set; }
    public virtual User CreatedByUser { get; set; } = null!;
    public virtual ICollection<Guid> VocabularyEntriesIds { get; set; } = null!;
    public Guid QuizId { get; set; }
    public virtual Quiz Quiz { get; set; }
}