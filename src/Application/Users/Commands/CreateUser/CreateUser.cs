using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.Users.Commands.CreateUser;

public class CreateUser : IRequest<OneOf<CreateUserResult.UserCreated, CreateUserResult.UserExists>>
{
    public long TelegramId { get; set; }

    public class Handler(ITraleDbContext dbContext) : IRequestHandler<CreateUser, OneOf<CreateUserResult.UserCreated, CreateUserResult.UserExists>>
    {
        public async Task<OneOf<CreateUserResult.UserCreated, CreateUserResult.UserExists>> Handle(CreateUser request, CancellationToken cancellationToken)
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
                InitialLanguageSet = false
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

public abstract record CreateUserResult
{
    public sealed record UserCreated(User User) : CreateUserResult;

    public sealed record UserExists(User User) : CreateUserResult;
}