using Application.Common;
using MediatR;

namespace Application.Quizzes.Queries;

public class CheckIsQuizStartedQuery : IRequest<bool>
{
    public Guid? UserId { get; set; }

    public class Handler : IRequestHandler<CheckIsQuizStartedQuery, bool>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<bool> Handle(CheckIsQuizStartedQuery request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            var user = await _dbContext.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                return false;
            }

            await _dbContext.Entry(user).Collection(nameof(user.Quizzes)).LoadAsync(ct);
            var startedQuizzesCount = user.Quizzes.Count(q => q.IsCompleted == false);
            return startedQuizzesCount > 0;
        }
    }
}