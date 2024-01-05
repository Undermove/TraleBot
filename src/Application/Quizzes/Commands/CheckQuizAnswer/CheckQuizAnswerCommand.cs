using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public class CheckQuizAnswerCommand: IRequest<CheckQuizAnswerResult>
{
    public Guid? UserId { get; init; }
    public required string Answer { get; init; }

    public class Handler(ITraleDbContext dbContext) : IRequestHandler<CheckQuizAnswerCommand, CheckQuizAnswerResult>
    {
        public async Task<CheckQuizAnswerResult> Handle(CheckQuizAnswerCommand request, CancellationToken ct)
        {
            var currentQuiz = await dbContext.Quizzes
                .OrderBy(quiz => quiz.DateStarted)
                .LastAsync(quiz =>
                quiz.UserId == request.UserId &&
                quiz.IsCompleted == false, cancellationToken: ct);

            await dbContext
                .Entry(currentQuiz)
                .Collection(nameof(currentQuiz.QuizQuestions))
                .LoadAsync(ct);

            if (currentQuiz.QuizQuestions.Count == 0 && currentQuiz is SharedQuiz sharedQuiz)
            {
                double correctnessPercent = currentQuiz.GetCorrectnessPercent();
                return new CheckQuizAnswerResult.SharedQuizCompleted(correctnessPercent, sharedQuiz.CreatedByUserName, sharedQuiz.CreatedByUserScore);
            }
            
            if (currentQuiz.QuizQuestions.Count == 0)
            {
                return new CheckQuizAnswerResult.QuizCompleted(currentQuiz.CorrectAnswersCount, currentQuiz.IncorrectAnswersCount,
                    currentQuiz.ShareableQuizId);
            }
            
            var quizQuestion = currentQuiz
                .QuizQuestions
                .OrderByDescending(entry => entry.OrderInQuiz)
                .Last();

            await dbContext.Entry(quizQuestion).Reference(nameof(quizQuestion.VocabularyEntry)).LoadAsync(ct);

            bool isAnswerCorrect =
                quizQuestion.Answer.Equals(request.Answer, StringComparison.InvariantCultureIgnoreCase);

            currentQuiz.ScorePoint(isAnswerCorrect);
            MasteringLevel? acquiredLevel = null;
            
            if(currentQuiz is not SharedQuiz)
            {
                quizQuestion.VocabularyEntry.ScorePoint(request.Answer);
                acquiredLevel = quizQuestion.VocabularyEntry.GetAcquiredLevel();   
            }
            
            currentQuiz.QuizQuestions.Remove(quizQuestion);
            dbContext.QuizQuestions.Remove(quizQuestion);
            
            await dbContext.SaveChangesAsync(ct);

            var nextQuizQuestion = currentQuiz
                .QuizQuestions
                .MinBy(entry => entry.OrderInQuiz);
            
            return isAnswerCorrect
                ? new CheckQuizAnswerResult.CorrectAnswer(
                    quizQuestion.VocabularyEntry.GetScoreToNextLevel(),
                    quizQuestion.VocabularyEntry.GetNextMasteringLevel(),
                    acquiredLevel,
                    nextQuizQuestion
                )
                : new CheckQuizAnswerResult.IncorrectAnswer(quizQuestion.Answer, nextQuizQuestion);
        }
    }
}