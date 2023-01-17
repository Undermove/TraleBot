using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CompleteQuiz;

public class CompleteQuizCommand : IRequest<QuizCompletionStatistics>
{
    public Guid? UserId { get; set; }

    public class Handler : IRequestHandler<CompleteQuizCommand, QuizCompletionStatistics>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<QuizCompletionStatistics> Handle(CompleteQuizCommand request, CancellationToken ct)
        {
            var quiz = await _dbContext.Quizzes
                .FirstAsync(quiz => quiz.UserId == request.UserId &&
                               quiz.IsCompleted == false, 
                    cancellationToken: ct);
            quiz.IsCompleted = true;
            await _dbContext.SaveChangesAsync(ct);
            return new QuizCompletionStatistics(quiz.CorrectAnswersCount, quiz.IncorrectAnswersCount);
        }
    }
}