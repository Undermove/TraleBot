namespace Domain.Entities;

public class SharedQuiz : Quiz
{
    public required string CreatedByUserName { get; set; }
    public required double CreatedByUserScore { get; set; }
}