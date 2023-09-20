using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.Quizzes.Commands.GetNextQuizQuestion;

public class GetNextQuizQuestionQuery : IRequest<OneOf<NextQuestion, QuizCompleted, SharedQuizCompleted>>
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<GetNextQuizQuestionQuery, OneOf<NextQuestion, QuizCompleted, SharedQuizCompleted>>
    {
        private readonly ITraleDbContext _dbContext;
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<OneOf<NextQuestion, QuizCompleted, SharedQuizCompleted>> Handle(GetNextQuizQuestionQuery request, CancellationToken ct)
        {
            var currentQuiz = await _dbContext.Quizzes
                .SingleAsync(quiz => 
                    quiz.UserId == request.UserId && 
                    quiz.IsCompleted == false, cancellationToken: ct);
            
            await _dbContext.Entry(currentQuiz).Collection(nameof(currentQuiz.QuizQuestions)).LoadAsync(ct);
            
            switch (currentQuiz.QuizQuestions.Count)
            {
                case 0 when currentQuiz.ShareableQuiz == null:
                {
                    return new SharedQuizCompleted(currentQuiz);
                }
                case 0:
                    return new QuizCompleted(currentQuiz.ShareableQuiz);
                default:
                {
                    var quizQuestion = currentQuiz
                        .QuizQuestions
                        .OrderByDescending(entry => entry.VocabularyEntry.DateAdded)
                        .Last();
            
                    return new NextQuestion(quizQuestion);
                }
            }
        }
    }
}