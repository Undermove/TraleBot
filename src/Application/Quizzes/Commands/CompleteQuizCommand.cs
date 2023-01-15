using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands;

public class CompleteQuizCommand : IRequest
{
    public Guid? UserId { get; set; }

    public class Handler : IRequestHandler<CompleteQuizCommand>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<Unit> Handle(CompleteQuizCommand request, CancellationToken ct)
        {
            var quiz = await _dbContext.Quizzes
                .FirstAsync(quiz => quiz.UserId == request.UserId &&
                               quiz.IsCompleted == false, 
                    cancellationToken: ct);
            quiz.IsCompleted = true;
            await _dbContext.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }
}