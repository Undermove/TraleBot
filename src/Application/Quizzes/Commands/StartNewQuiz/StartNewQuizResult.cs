namespace Application.Quizzes.Commands.StartNewQuiz;

public record StartNewQuizResult(int LastWeekVocabularyEntriesCount, QuizStartStatus QuizStartStatus);

public enum QuizStartStatus
{
	Success,
	AlreadyStarted,
	NotEnoughWords,
	NeedPremiumToActivate
}