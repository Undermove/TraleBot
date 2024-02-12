using Application.Common;
using Application.Users.Commands.CreateUser;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Users.Commands;

public class DeactivateUser : IRequest<CreateUserResult>
{
    public long TelegramId { get; set; }
    
    public class Handler(ITraleDbContext dbContext) : IRequestHandler<DeactivateUser, CreateUserResult>
    {
        public async Task<CreateUserResult> Handle(DeactivateUser request, CancellationToken cancellationToken)
        {
            User? user = await dbContext.Users.FirstOrDefaultAsync(
                user => user.TelegramId == request.TelegramId,
                cancellationToken: cancellationToken);
            if (user != null)
            {
                return new CreateUserResult.UserExists(user);
            }
            
            user = new User
            {
                Id = Guid.NewGuid(),
                TelegramId = request.TelegramId,
                RegisteredAtUtc = DateTime.UtcNow,
                AccountType = UserAccountType.Free,
                InitialLanguageSet = false,
                IsActive = false
            };
            
            var settings = new UserSettings
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                User = user,
                CurrentLanguage = Language.English
            };
            
            user.UserSettingsId = settings.Id;

            var transaction = await dbContext.BeginTransactionAsync(cancellationToken);
            
            dbContext.Users.Add(user);
            dbContext.UsersSettings.Add(settings);

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new CreateUserResult.UserCreated(user);
        }
    }
}

public abstract record DisableUserResult
{
    public sealed record Success(User User) : DisableUserResult;

    public sealed record Fail(User User) : DisableUserResult;
}