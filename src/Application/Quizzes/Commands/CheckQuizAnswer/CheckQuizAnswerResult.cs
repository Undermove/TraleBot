using Domain.Entities;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public abstract record CheckQuizAnswerResult
{
    public sealed record IncorrectAnswer(string CorrectWord, QuizQuestion? NextQuizQuestion) : CheckQuizAnswerResult;

    public record CorrectAnswer(
        int? ScoreToNextLevel,
        MasteringLevel? NextLevel,
        MasteringLevel? AcquiredLevel,
        QuizQuestion? NextQuizQuestion) : CheckQuizAnswerResult;

    public record QuizCompleted(
        int CorrectAnswersCount,
        int IncorrectAnswersCount,
        Guid ShareableQuizId) : CheckQuizAnswerResult;

    public record SharedQuizCompleted(double CurrentUserScore, string QuizAuthorName, double QuizAuthorScore) : CheckQuizAnswerResult;
}