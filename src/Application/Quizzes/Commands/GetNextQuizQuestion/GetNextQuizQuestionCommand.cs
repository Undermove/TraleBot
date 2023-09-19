using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.Quizzes.Commands.GetNextQuizQuestion;

public class GetNextQuizQuestionQuery : IRequest<OneOf<NextQuestion, QuizCompleted>>
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<GetNextQuizQuestionQuery, OneOf<NextQuestion, QuizCompleted>>
    {
        private readonly ITraleDbContext _dbContext;
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<OneOf<NextQuestion, QuizCompleted>> Handle(GetNextQuizQuestionQuery request, CancellationToken ct)
        {
            var currentQuiz = await _dbContext.Quizzes
                .SingleAsync(quiz => 
                    quiz.UserId == request.UserId && 
                    quiz.IsCompleted == false, cancellationToken: ct);
            
            await _dbContext.Entry(currentQuiz).Collection(nameof(currentQuiz.QuizQuestions)).LoadAsync(ct);
            if (currentQuiz.QuizQuestions.Count == 0)
            {
                return new QuizCompleted(currentQuiz);
            }

            var quizQuestion = currentQuiz
                .QuizQuestions
                .OrderByDescending(entry => entry.VocabularyEntry.DateAdded)
                .Last();
            
            return new NextQuestion(quizQuestion);
        }
    }
}