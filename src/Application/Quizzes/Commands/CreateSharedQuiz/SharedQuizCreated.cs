using Domain.Entities;

namespace Application.Quizzes.Commands.CreateSharedQuiz;

public record SharedQuizCreated(int QuestionsCount, QuizQuestion FirstQuestion);

public record NotEnoughQuestionsForSharedQuiz();

public record AnotherQuizInProgress();
