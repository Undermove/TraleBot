using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public class CheckQuizAnswerCommand: IRequest<CheckQuizAnswerResult>
{
    public Guid? UserId { get; set; }
    public string Answer { get; set; }

    public class Handler : IRequestHandler<CheckQuizAnswerCommand, CheckQuizAnswerResult>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<CheckQuizAnswerResult> Handle(CheckQuizAnswerCommand request, CancellationToken ct)
        {
            var currentQuiz = await _dbContext.Quizzes
                .OrderBy(quiz => quiz.DateStarted)
                .LastAsync(quiz =>
                quiz.UserId == request.UserId &&
                quiz.IsCompleted == false, cancellationToken: ct);

            await _dbContext
                .Entry(currentQuiz)
                .Collection(nameof(currentQuiz.QuizVocabularyEntries))
                .LoadAsync(ct);

            if (currentQuiz.QuizVocabularyEntries.Count == 0)
            {
                throw new ApplicationException("Looks like quiz already completed of not started yet");
            }
            
            var quizVocabularyEntry = currentQuiz
                .QuizVocabularyEntries
                .OrderBy(entry => entry.VocabularyEntryId)
                .Last();
            await _dbContext.Entry(quizVocabularyEntry).Reference(nameof(quizVocabularyEntry.VocabularyEntry)).LoadAsync(ct);
            
            if (quizVocabularyEntry.VocabularyEntry.Definition != request.Answer.ToLowerInvariant())
            {
                currentQuiz.IncorrectAnswersCount++;
                currentQuiz.QuizVocabularyEntries.Remove(quizVocabularyEntry);
                quizVocabularyEntry.VocabularyEntry.FailedAnswersCount++;
                await _dbContext.SaveChangesAsync(ct);
                return new CheckQuizAnswerResult(false, quizVocabularyEntry.VocabularyEntry.Definition);
            }
            
            currentQuiz.CorrectAnswersCount++;
            quizVocabularyEntry.VocabularyEntry.SuccessAnswersCount++;
            currentQuiz.QuizVocabularyEntries.Remove(quizVocabularyEntry);
            await _dbContext.SaveChangesAsync(ct);
            return new CheckQuizAnswerResult(true, quizVocabularyEntry.VocabularyEntry.Definition);;
        }
    }
}