namespace Domain.Entities;

public class ShareableQuiz
{
    public Guid Id { get; set; }
    public Guid CreatedByUserId { get; set; }
    public virtual User CreatedByUser { get; set; }
    public QuizTypes QuizType { get; set; }
    public virtual ICollection<VocabularyEntry> VocabularyEntries { get; set; }
}