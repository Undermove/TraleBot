namespace Domain.Entities;

public class QuizQuestionWithVariants : QuizQuestion
{
    public required string[] Variants { get; set; }
    public override string QuestionType { get; set; } = nameof(QuizQuestionWithVariants);
}