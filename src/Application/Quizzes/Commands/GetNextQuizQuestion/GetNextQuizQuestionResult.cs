using Domain.Entities;

namespace Application.Quizzes.Commands.GetNextQuizQuestion;

public record NextQuestion(QuizQuestion Question);


// change quiz to shareable quiz
public record QuizCompleted(ShareableQuiz? ShareableQuiz);