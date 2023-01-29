using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Users.Commands.CreateUser;

public class CreateUserCommand : IRequest<UserCreatedResultType>
{
    public long TelegramId { get; set; }

    public class Handler : IRequestHandler<CreateUserCommand, UserCreatedResultType>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
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
                Id = Guid.NewGuid(),
                TelegramId = request.TelegramId,
            };
            _dbContext.Users.Add(user);

            await _dbContext.SaveChangesAsync(cancellationToken);

            return UserCreatedResultType.Success;
        }
    }
}