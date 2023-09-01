namespace Domain.Entities;

public class SharedQuiz
{
    public Guid Id { get; set; }
    public Guid CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; }
    public QuizTypes QuizType { get; set; }
    public virtual ICollection<VocabularyEntry> VocabularyEntries { get; set; }
}