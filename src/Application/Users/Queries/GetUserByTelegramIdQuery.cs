using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Users.Queries;

public class GetUserByTelegramId: IRequest<User?>
{
    public long? TelegramId { get; set; }

    public class Handler : IRequestHandler<GetUserByTelegramId, User?>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<User?> Handle(GetUserByTelegramId request, CancellationToken cancellationToken)
        {
            var user = await _dbContext.Users
                .Where(u => u.TelegramId == request.TelegramId)
                .FirstOrDefaultAsync(cancellationToken);

            if (user != null)
            {
                await _dbContext
                    .Entry(user)
                    .Collection(nameof(user.Settings))
                    .LoadAsync(cancellationToken);    
            }
            
            return user;
        }
    }
}