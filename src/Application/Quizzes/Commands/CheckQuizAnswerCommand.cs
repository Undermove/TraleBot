using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands;

public class CheckQuizAnswerCommand: IRequest<bool>
{
    public Guid? UserId { get; set; }
    public string Answer { get; set; }

    public class Handler : IRequestHandler<CheckQuizAnswerCommand, bool>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<bool> Handle(CheckQuizAnswerCommand request, CancellationToken ct)
        {
            var currentQuiz = await _dbContext.Quizzes
                .OrderBy(quiz => quiz.DateStarted)
                .LastAsync(quiz =>
                quiz.UserId == request.UserId &&
                quiz.IsCompleted == false, cancellationToken: ct);

            await _dbContext.Entry(currentQuiz).Collection(nameof(currentQuiz.QuizVocabularyEntries)).LoadAsync(ct);
            var quizVocabularyEntry = currentQuiz.QuizVocabularyEntries[0];

            if (quizVocabularyEntry.VocabularyEntry.Definition != request.Answer)
            {
                return false;
            }
            
            currentQuiz.QuizVocabularyEntries.Remove(quizVocabularyEntry);
            await _dbContext.SaveChangesAsync(ct);
            return true;
        }
    }
}