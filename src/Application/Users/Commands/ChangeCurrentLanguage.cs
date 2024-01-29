using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class ChangeCurrentLanguage : IRequest<ChangeLanguageResult>
{
    public required User User { get; set; }
    public required Language TargetLanguage { get; set; }
    
    public class Handler(ITraleDbContext context) : IRequestHandler<ChangeCurrentLanguage, ChangeLanguageResult>
    {
        public async Task<ChangeLanguageResult> Handle(ChangeCurrentLanguage request, CancellationToken ct)
        {
            if (!request.User.IsActivePremium())
            {
                return new ChangeLanguageResult.PremiumRequired(request.User.Settings.CurrentLanguage, request.TargetLanguage);
            }
            request.User.Settings.CurrentLanguage = request.TargetLanguage;
            await context.SaveChangesAsync(ct);
            return new ChangeLanguageResult.Success(request.TargetLanguage);
        }
    }
}

public abstract record ChangeLanguageResult
{
    public record Success(Language CurrentLanguage) : ChangeLanguageResult;
    public record PremiumRequired(Language CurrentLanguage, Language TargetLanguage) : ChangeLanguageResult;
}