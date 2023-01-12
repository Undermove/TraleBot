using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes;

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
            var vocabularyEntries = currentQuiz.QuizVocabularyEntries
                .Select(entry => entry.VocabularyEntry)
                .ToList();

            if (vocabularyEntries.Count == 0)
            {
                return null;
            }
            
            return vocabularyEntries[0];
        }
    }
}