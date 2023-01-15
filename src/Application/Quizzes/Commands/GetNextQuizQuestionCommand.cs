using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands;

public class GetNextQuizQuestionQuery : IRequest<VocabularyEntry?>
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<GetNextQuizQuestionQuery, VocabularyEntry?>
    {
        private readonly ITraleDbContext _dbContext;
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<VocabularyEntry?> Handle(GetNextQuizQuestionQuery request, CancellationToken ct)
        {
            var currentQuiz = await _dbContext.Quizzes
                .SingleAsync(quiz => 
                    quiz.UserId == request.UserId && 
                    quiz.IsCompleted == false, cancellationToken: ct);
            
            await _dbContext.Entry(currentQuiz).Collection(nameof(currentQuiz.QuizVocabularyEntries)).LoadAsync(ct);
            var vocabularyEntryId = currentQuiz.QuizVocabularyEntries
                .OrderBy(entry => entry.VocabularyEntryId)
                .Select(entry => entry.VocabularyEntryId)
                .Last();
            object?[] keyValues = { vocabularyEntryId };
            var vocabularyEntry = await _dbContext.VocabularyEntries.FindAsync(keyValues, ct);
            return vocabularyEntry;
        }
    }
}