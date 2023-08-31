namespace Domain.Entities;

public class SharedQuiz
{
    public Guid Id { get; set; }
    public QuizTypes QuizType { get; set; }
    public virtual ICollection<VocabularyEntry> VocabularyEntries { get; set; }
}