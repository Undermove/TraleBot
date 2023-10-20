using Domain.Entities;

namespace Application.Quizzes.Commands.StartNewQuiz;

public record QuizStarted(int QuizQuestionsCount, QuizQuestion FirstQuestion);
public record NotEnoughWords;
public record QuizAlreadyStarted;