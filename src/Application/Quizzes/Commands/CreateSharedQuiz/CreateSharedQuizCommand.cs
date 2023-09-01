using Application.Common;
using MediatR;

namespace Application.Quizzes.Commands.CreateSharedQuiz;

public class CreateSharedQuizCommand : IRequest<SharedQuizCreatedResult>
{
    public class Handler : IRequestHandler<CreateSharedQuizCommand, SharedQuizCreatedResult>
    {
        public Handler(ITraleDbContext context)
        {
            throw new NotImplementedException();
        }

        public Task<SharedQuizCreatedResult> Handle(CreateSharedQuizCommand request, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}