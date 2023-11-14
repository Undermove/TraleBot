using Application.Common;
using Application.Common.Exceptions;
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

            var startedQuiz = _dbContext.Quizzes.FirstOrDefault(q => q.UserId == request.UserId && q.IsCompleted == false);
            if (startedQuiz == null)
            {
                return Unit.Value;
            }

            await using var transaction =  await _dbContext.BeginTransactionAsync(ct);
            try
            {
                startedQuiz.IsCompleted = true;
                _dbContext.Quizzes.Update(startedQuiz);
                _dbContext.QuizQuestions.RemoveRange(startedQuiz.QuizQuestions.ToArray());

                await _dbContext.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            }
            catch (Exception)
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
            
            return Unit.Value;
        }
    }
}