using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public class CheckQuizAnswerCommand: IRequest<OneOf<CorrectAnswer, IncorrectAnswer, QuizCompleted, SharedQuizCompleted>>
{
    public Guid? UserId { get; init; }
    public required string Answer { get; init; }

    public class Handler : IRequestHandler<CheckQuizAnswerCommand, OneOf<CorrectAnswer, IncorrectAnswer, QuizCompleted, SharedQuizCompleted>>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<OneOf<CorrectAnswer, IncorrectAnswer, QuizCompleted, SharedQuizCompleted>> Handle(CheckQuizAnswerCommand request, CancellationToken ct)
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
            
            if (currentQuiz.QuizQuestions.Count == 0 && currentQuiz.ShareableQuiz == null)
            {
                return new SharedQuizCompleted(currentQuiz);
            }
            
            if (currentQuiz.QuizQuestions.Count == 0)
            {
                return new QuizCompleted(currentQuiz.CorrectAnswersCount, currentQuiz.IncorrectAnswersCount,
                    currentQuiz.ShareableQuizId);
            }
            
            var quizQuestion = currentQuiz
                .QuizQuestions
                .OrderByDescending(entry => entry.OrderInQuiz)
                .Last();

            await _dbContext.Entry(quizQuestion).Reference(nameof(quizQuestion.VocabularyEntry)).LoadAsync(ct);

            bool isAnswerCorrect =
                quizQuestion.Answer.Equals(request.Answer, StringComparison.InvariantCultureIgnoreCase);

            currentQuiz.ScorePoint(isAnswerCorrect);
            MasteringLevel? acquiredLevel = null;

            // todo: create a separate class for quiz that created from shareable quiz and
            // move this logic there to specified handler to avoid this unclear behavior
            if(currentQuiz.ShareableQuiz != null)
            {
                quizQuestion.VocabularyEntry.ScorePoint(request.Answer);
                acquiredLevel = quizQuestion.VocabularyEntry.GetAcquiredLevel();   
            }
            
            currentQuiz.QuizQuestions.Remove(quizQuestion);
            _dbContext.QuizQuestions.Remove(quizQuestion);
            
            await _dbContext.SaveChangesAsync(ct);

            var nextQuizQuestion = currentQuiz
                .QuizQuestions
                .MinBy(entry => entry.OrderInQuiz);
            
            return isAnswerCorrect
                ? new CorrectAnswer(
                    quizQuestion.VocabularyEntry.GetScoreToNextLevel(),
                    quizQuestion.VocabularyEntry.GetNextMasteringLevel(),
                    acquiredLevel,
                    nextQuizQuestion
                )
                : new IncorrectAnswer(quizQuestion.Answer, nextQuizQuestion);
        }
    }
}