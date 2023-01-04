using Application.Common;
using Application.Common.Models;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Users.Commands.CreateUser;

public class CreateUserCommand : IRequest<UserCreatedResultType>, ITransactional
{
    public long TelegramId { get; set; }

    public class Handler : IRequestHandler<CreateUserCommand, UserCreatedResultType>
    {
        private readonly ITraleDbContext _dbContext;
        private readonly IMediator _mediator;

        public Handler(ITraleDbContext dbContext, IMediator mediator)
        {
            _dbContext = dbContext;
            _mediator = mediator;
        }

        public async Task<UserCreatedResultType> Handle(CreateUserCommand request, CancellationToken cancellationToken)
        {
            User? user = await _dbContext.Users.FirstOrDefaultAsync(
                user => user.TelegramId == request.TelegramId,
                cancellationToken: cancellationToken);
            if (user != null)
            {
                return UserCreatedResultType.UserAlreadyExists;
            }

            user = new User
            {
                UserId = Guid.NewGuid().ToString(),
                TelegramId = request.TelegramId,
            };
            _dbContext.Users.Add(user);

            await _dbContext.SaveChangesAsync(cancellationToken);

            return UserCreatedResultType.Success;
        }
    }
}