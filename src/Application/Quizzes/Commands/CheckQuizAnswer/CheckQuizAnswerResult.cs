namespace Application.Quizzes.Commands.CheckQuizAnswer;

public record CheckQuizAnswerResult(bool IsAnswerCorrect, string CorrectAnswer);