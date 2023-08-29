namespace Application.Quizzes.Commands.StartNewQuiz;

public record QuizStarted(int QuizQuestionsCount);
public record NotEnoughWords;
public record NeedPremiumToActivate;
public record QuizAlreadyStarted;