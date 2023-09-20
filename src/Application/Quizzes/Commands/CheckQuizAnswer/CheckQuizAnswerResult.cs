using Domain.Entities;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public record IncorrectAnswer(string CorrectAnswer);

public record CorrectAnswer(int? ScoreToNextLevel, MasteringLevel? NextLevel, MasteringLevel? AcquiredLevel);
    
public record QuizCompleted(int CorrectAnswersCount, int IncorrectAnswersCount);