namespace Domain.Entities;

public class QuizQuestionWithTypeAnswer : QuizQuestion
{
    public override string QuestionType { get; set; } = nameof(QuizQuestionWithTypeAnswer);
}