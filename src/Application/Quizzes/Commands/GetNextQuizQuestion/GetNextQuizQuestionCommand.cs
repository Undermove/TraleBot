using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.GetNextQuizQuestion;

public class GetNextQuizQuestionQuery : IRequest<QuizQuestion?>
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<GetNextQuizQuestionQuery, QuizQuestion?>
    {
        private readonly ITraleDbContext _dbContext;
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<QuizQuestion?> Handle(GetNextQuizQuestionQuery request, CancellationToken ct)
        {
            var currentQuiz = await _dbContext.Quizzes
                .SingleAsync(quiz => 
                    quiz.UserId == request.UserId && 
                    quiz.IsCompleted == false, cancellationToken: ct);
            
            await _dbContext.Entry(currentQuiz).Collection(nameof(currentQuiz.QuizQuestions)).LoadAsync(ct);
            if (currentQuiz.QuizQuestions.Count == 0)
            {
                return null;
            } 

            var quizQuestion = currentQuiz
                .QuizQuestions
                .OrderByDescending(entry => entry.VocabularyEntry.DateAdded)
                .Last();
            return quizQuestion;
        }
    }
}