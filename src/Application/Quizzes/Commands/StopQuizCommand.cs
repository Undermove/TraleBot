using Application.Common;
using Application.Common.Exceptions;
using Domain.Entities;
using MediatR;

namespace Application.Quizzes.Commands;

public class StopQuizCommand : IRequest
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<StopQuizCommand>
    {
        private readonly ITraleDbContext _dbContext;
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<Unit> Handle(StopQuizCommand request, CancellationToken ct)
        {
            if (request.UserId == null)
            {
                throw new ArgumentException("User Id cannot be null");
            }
            
            // todo: check here if any quizzes already started

            object?[] keyValues = { request.UserId };
            var user = await _dbContext.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                throw new NotFoundException("User", request.UserId);
            }
            await _dbContext.Entry(user).Collection(nameof(user.Quizzes)).LoadAsync(ct);
            var startedQuiz = user.Quizzes.FirstOrDefault(q => q.IsCompleted == false);
            if (startedQuiz == null)
            {
                return Unit.Value;
            }

            startedQuiz.IsCompleted = true;
            _dbContext.Quizzes.Update(startedQuiz);

            await _dbContext.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }
}