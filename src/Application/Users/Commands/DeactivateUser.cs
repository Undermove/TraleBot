using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class DeactivateUser : IRequest<DisableUserResult>
{
    public Guid UserId { get; set; }
    
    public class Handler(ITraleDbContext dbContext) : IRequestHandler<DeactivateUser, DisableUserResult>
    {
        public async Task<DisableUserResult> Handle(DeactivateUser request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            var user = await dbContext.Users.FindAsync(keyValues: keyValues, ct);

            if (user == null)
            {
                return new DisableUserResult.Fail();
            }
            
            user.IsActive = false;
            
            await dbContext.SaveChangesAsync(ct);
            return new DisableUserResult.Success(user);
        }
    }
}

public abstract record DisableUserResult
{
    public sealed record Success(User User) : DisableUserResult;

    public sealed record Fail : DisableUserResult;
}