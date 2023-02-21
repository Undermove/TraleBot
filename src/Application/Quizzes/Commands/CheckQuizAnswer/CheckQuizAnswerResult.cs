using Domain.Entities;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public record CheckQuizAnswerResult(bool IsAnswerCorrect, string CorrectAnswer, int ScoreToNextLevel);

enum WordLevelChanged
{
    NothingChanged,
    MasteredInForwardDirection,
    MasteredInBothDirections,
}

public record CheckQuizAnswerResult2(
    bool IsAnswerCorrect, 
    int CorrectAnswer, 
    int ScoreToNextLevel,
    MasteringLevel NextLevel,
    QuizDirection QuizDirection);

public enum QuizDirection
{
    WordDefinition,
    DefinitionWord
}