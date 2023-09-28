namespace Domain.Entities;

public class QuizQuestionWithVariants : QuizQuestion
{
    public required string[] Variants { get; set; }
}