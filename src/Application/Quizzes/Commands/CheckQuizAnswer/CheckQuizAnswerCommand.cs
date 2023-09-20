using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public class CheckQuizAnswerCommand: IRequest<OneOf<CheckQuizAnswerResult, QuizCompletedResult>>
{
    public Guid? UserId { get; init; }
    public required string Answer { get; init; }

    public class Handler : IRequestHandler<CheckQuizAnswerCommand, OneOf<CheckQuizAnswerResult, QuizCompletedResult>>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<OneOf<CheckQuizAnswerResult, QuizCompletedResult>> Handle(CheckQuizAnswerCommand request, CancellationToken ct)
        {
            var currentQuiz = await _dbContext.Quizzes
                .OrderBy(quiz => quiz.DateStarted)
                .LastAsync(quiz =>
                quiz.UserId == request.UserId &&
                quiz.IsCompleted == false, cancellationToken: ct);

            await _dbContext
                .Entry(currentQuiz)
                .Collection(nameof(currentQuiz.QuizQuestions))
                .LoadAsync(ct);
            
            if (currentQuiz.QuizQuestions.Count == 0)
            {
                return new QuizCompletedResult(currentQuiz.CorrectAnswersCount, currentQuiz.IncorrectAnswersCount);
            }
            
            var quizQuestion = currentQuiz
                .QuizQuestions
                .OrderByDescending(entry => entry.VocabularyEntry.DateAdded)
                .Last();

            await _dbContext.Entry(quizQuestion).Reference(nameof(quizQuestion.VocabularyEntry)).LoadAsync(ct);

            bool isAnswerCorrect =
                quizQuestion.Answer.Equals(request.Answer, StringComparison.InvariantCultureIgnoreCase);

            currentQuiz.ScorePoint(isAnswerCorrect);
            var masteringLevel = quizQuestion.VocabularyEntry.ScorePoint(request.Answer);
            
            currentQuiz.QuizQuestions.Remove(quizQuestion);
            _dbContext.QuizQuestions.Remove(quizQuestion);
            
            await _dbContext.SaveChangesAsync(ct);
            return new CheckQuizAnswerResult(
                isAnswerCorrect, 
                quizQuestion.Answer, 
                quizQuestion.VocabularyEntry.GetScoreToNextLevel(),
                quizQuestion.VocabularyEntry.GetNextMasteringLevel(),
                masteringLevel);
        }
    }
}