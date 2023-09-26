namespace Domain.Entities;

public abstract class QuizQuestion
{
    public required Guid Id { get; set; }
    public required string Question { get; set; }
    public required string Answer { get; set; }
    public required string Example { get; set; }
    
    public Guid VocabularyEntryId { get; set; }
    public virtual required VocabularyEntry VocabularyEntry { get; set; }
}

public class QuizQuestionWithTypeAnswer : QuizQuestion
{
}

public class QuizQuestionWithVariants : QuizQuestion
{
    public required string[] Variants { get; set; }
}