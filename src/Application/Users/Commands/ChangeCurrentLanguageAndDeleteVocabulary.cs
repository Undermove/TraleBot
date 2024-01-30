using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Users.Commands;

public class ChangeCurrentLanguageAndDeleteVocabulary : IRequest<ChangeCurrentLanguageAndDeleteVocabularyResult>
{
    public required User User { get; set; }
    public required Language TargetLanguage { get; set; }
    
    public class Handler(ITraleDbContext context) : IRequestHandler<ChangeCurrentLanguageAndDeleteVocabulary, ChangeCurrentLanguageAndDeleteVocabularyResult>
    {
        public async Task<ChangeCurrentLanguageAndDeleteVocabularyResult> Handle(ChangeCurrentLanguageAndDeleteVocabulary request, CancellationToken ct)
        {
            if (request.User.IsActivePremium())
            {
                return new ChangeCurrentLanguageAndDeleteVocabularyResult.NoActionNeeded();
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
            
            return new ChangeCurrentLanguageAndDeleteVocabularyResult.Success(request.TargetLanguage);
        }
    }
}

public abstract record ChangeCurrentLanguageAndDeleteVocabularyResult
{
    public record Success(Language CurrentLanguage) : ChangeCurrentLanguageAndDeleteVocabularyResult;
    public record NoActionNeeded() : ChangeCurrentLanguageAndDeleteVocabularyResult;
}