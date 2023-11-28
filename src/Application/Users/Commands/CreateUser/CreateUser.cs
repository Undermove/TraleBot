using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.Users.Commands.CreateUser;

public class CreateUser : IRequest<OneOf<UserCreated, UserExists>>
{
    public long TelegramId { get; set; }

    public class Handler : IRequestHandler<CreateUser, OneOf<UserCreated, UserExists>>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<OneOf<UserCreated, UserExists>> Handle(CreateUser request, CancellationToken cancellationToken)
        {
            User? user = await _dbContext.Users.FirstOrDefaultAsync(
                user => user.TelegramId == request.TelegramId,
                cancellationToken: cancellationToken);
            if (user != null)
            {
                return new UserExists(user);
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

            var transaction = await _dbContext.BeginTransactionAsync(cancellationToken);
            
            _dbContext.Users.Add(user);
            _dbContext.UsersSettings.Add(settings);

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new UserCreated(user);
        }
    }
}