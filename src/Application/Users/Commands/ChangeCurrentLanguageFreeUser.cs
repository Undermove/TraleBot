using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Users.Commands;

public class ChangeCurrentLanguageFreeUser : IRequest<ChangeLanguageFreeUserResult>
{
    public required User User { get; set; }
    public required Language TargetLanguage { get; set; }
    
    public class Handler(ITraleDbContext context) : IRequestHandler<ChangeCurrentLanguageFreeUser, ChangeLanguageFreeUserResult>
    {
        public async Task<ChangeLanguageFreeUserResult> Handle(ChangeCurrentLanguageFreeUser request, CancellationToken ct)
        {
            if (request.User.IsActivePremium())
            {
                return new ChangeLanguageFreeUserResult.NoActionNeeded();
            }
            
            await using var transaction = await context.BeginTransactionAsync(ct);
            try
            {
                var otherVocabulary = await context.VocabularyEntries
                    .ToListAsync(ct);

                context.VocabularyEntries.RemoveRange(otherVocabulary);
            
                request.User.Settings.CurrentLanguage = request.TargetLanguage;
                await context.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            }
            catch (Exception)
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
            
            return new ChangeLanguageFreeUserResult.Success(request.TargetLanguage);
        }
    }
}

public abstract record ChangeLanguageFreeUserResult
{
    public record Success(Language CurrentLanguage) : ChangeLanguageFreeUserResult;
    public record NoActionNeeded() : ChangeLanguageFreeUserResult;
}