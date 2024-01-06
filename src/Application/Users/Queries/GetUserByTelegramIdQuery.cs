using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Users.Queries;

public class GetUserByTelegramId: IRequest<GetUserResult>
{
    public required long TelegramId { get; init; }

    public class Handler(ITraleDbContext dbContext) : IRequestHandler<GetUserByTelegramId, GetUserResult>
    {
        public async Task<GetUserResult> Handle(GetUserByTelegramId request, CancellationToken cancellationToken)
        {
            var user = await dbContext.Users
                .Where(u => u.TelegramId == request.TelegramId)
                .FirstOrDefaultAsync(cancellationToken);

            if (user == null)
            {
                return new GetUserResult.UserNotExists();
            }

            await dbContext
                .Entry(user)
                .Reference(nameof(user.Settings))
                .LoadAsync(cancellationToken);

            return new GetUserResult.ExistedUser(user);
        }
    }
}

public abstract record GetUserResult
{
    public sealed record ExistedUser(User User) : GetUserResult;
    
    public sealed record UserNotExists : GetUserResult;
}