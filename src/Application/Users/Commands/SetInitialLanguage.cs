using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class SetInitialLanguage : IRequest<SetInitialLanguageResult>
{
    public required Guid UserId { get; init; }
    public required Language InitialLanguage { get; init; }
    
    public class Handler : IRequestHandler<SetInitialLanguage, SetInitialLanguageResult>
    {
        private readonly ITraleDbContext _context;

        public Handler(ITraleDbContext context)
        {
            _context = context;
        }

        public async Task<SetInitialLanguageResult> Handle(SetInitialLanguage request, CancellationToken cancellationToken)
        {
            var user = await _context.Users.FindAsync( new object[] { request.UserId }, cancellationToken);

            if (user == null)
            {
                throw new ApplicationException("user not found");
            }
            
            if (user is { InitialLanguageSet: true })
            {
                return new SetInitialLanguageResult.InitialLanguageAlreadySet();
            }
            
            var userSettings = await _context.UsersSettings.FindAsync(new object[] { user.UserSettingsId }, cancellationToken); 

            user.InitialLanguageSet = true;
            userSettings!.CurrentLanguage = request.InitialLanguage;
            
            _context.Users.Update(user);
            _context.UsersSettings.Update(userSettings);
            await _context.SaveChangesAsync(cancellationToken);
            
            return new SetInitialLanguageResult.InitialLanguageSet(request.InitialLanguage);
        }
    }
}

public abstract record SetInitialLanguageResult
{
    public sealed record InitialLanguageSet(Language InitialLanguage) : SetInitialLanguageResult;
    public sealed record InitialLanguageAlreadySet() : SetInitialLanguageResult;
}