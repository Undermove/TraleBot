namespace Domain.Entities;

public class SharedQuiz : Quiz
{
    Quiz ParentQuiz { get; set; } = null!;
}