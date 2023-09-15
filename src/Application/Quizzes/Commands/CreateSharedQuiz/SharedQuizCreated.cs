namespace Application.Quizzes.Commands.CreateSharedQuiz;

public record SharedQuizCreated(int QuestionsCount);

public record NotEnoughQuestionsForSharedQuiz();

public record AnotherQuizInProgress();
