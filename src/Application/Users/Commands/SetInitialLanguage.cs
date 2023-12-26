using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class SetInitialLanguage : IRequest<SetInitialLanguageResult>
{
    public required Guid UserId { get; init; }
    public required Language InitialLanguage { get; init; }
    
    public class Handler(ITraleDbContext context) : IRequestHandler<SetInitialLanguage, SetInitialLanguageResult>
    {
        public async Task<SetInitialLanguageResult> Handle(SetInitialLanguage request, CancellationToken cancellationToken)
        {
            var user = await context.Users.FindAsync( new object[] { request.UserId }, cancellationToken);

            if (user == null)
            {
                throw new ApplicationException("user not found");
            }
            
            if (user is { InitialLanguageSet: true })
            {
                return new SetInitialLanguageResult.InitialLanguageAlreadySet();
            }
            
            var userSettings = await context.UsersSettings.FindAsync(new object[] { user.UserSettingsId }, cancellationToken); 

            user.InitialLanguageSet = true;
            userSettings!.CurrentLanguage = request.InitialLanguage;
            
            context.Users.Update(user);
            context.UsersSettings.Update(userSettings);
            await context.SaveChangesAsync(cancellationToken);
            
            return new SetInitialLanguageResult.InitialLanguageSet(request.InitialLanguage);
        }
    }
}

public abstract record SetInitialLanguageResult
{
    public sealed record InitialLanguageSet(Language InitialLanguage) : SetInitialLanguageResult;
    public sealed record InitialLanguageAlreadySet() : SetInitialLanguageResult;
}