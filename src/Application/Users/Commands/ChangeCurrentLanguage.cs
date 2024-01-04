using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class ChangeCurrentLanguage : IRequest<Language>
{
    public required User User { get; set; }
    public required Language TargetLanguage { get; set; }
    
    public class Handler(ITraleDbContext context) : IRequestHandler<ChangeCurrentLanguage, Language>
    {
        public async Task<Language> Handle(ChangeCurrentLanguage request, CancellationToken ct)
        {
            
            request.User.Settings.CurrentLanguage = request.TargetLanguage;
            await context.SaveChangesAsync(ct);
            return request.TargetLanguage;
        }
    }
}