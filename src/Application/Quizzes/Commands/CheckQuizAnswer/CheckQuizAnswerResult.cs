using Domain.Entities;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public record IncorrectAnswer(string CorrectAnswer, QuizQuestion? NextQuizQuestion);

public record CorrectAnswer(
    int? ScoreToNextLevel, 
    MasteringLevel? NextLevel,
    MasteringLevel? AcquiredLevel,
    QuizQuestion? NextQuizQuestion);
    
public record QuizCompleted(
    int CorrectAnswersCount,
    int IncorrectAnswersCount,
    Guid ShareableQuizId);
    
public record SharedQuizCompleted(Quiz Quiz);