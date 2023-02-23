using Domain.Entities;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public record CheckQuizAnswerResult(
    bool IsAnswerCorrect, 
    string CorrectAnswer, 
    int? ScoreToNextLevel,
    MasteringLevel? NextLevel,
    MasteringLevel? AcquiredLevel);