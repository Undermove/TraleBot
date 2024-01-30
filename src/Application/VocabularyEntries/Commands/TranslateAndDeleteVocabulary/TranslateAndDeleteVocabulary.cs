using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.VocabularyEntries.Commands.TranslateAndDeleteVocabulary;

public class TranslateAndDeleteVocabulary : IRequest<ChangeAndTranslationResult>
{
    public required User User { get; init; }
    public required Language TargetLanguage { get; init; }
    public required Guid VocabularyEntryId { get; init; }

    public class Handler(
        ITraleDbContext context,
        ILanguageTranslator languageTranslator)
        : IRequestHandler<TranslateAndDeleteVocabulary, ChangeAndTranslationResult>
    {
        public async Task<ChangeAndTranslationResult> Handle(TranslateAndDeleteVocabulary request, CancellationToken ct)
        {
            var user = request.User;
            object?[] keyValues = { request.VocabularyEntryId };
            var sourceEntry = await context.VocabularyEntries.FindAsync(keyValues, cancellationToken: ct);

            if (request.User.IsActivePremium())
            {
                return new ChangeAndTranslationResult.NoActionNeeded();
            }

            if (sourceEntry == null)
            {
                throw new ApplicationException("original entry not found");
            }

            await using var transaction = await context.BeginTransactionAsync(ct);

            try
            {
                var result = await languageTranslator.Translate(sourceEntry.Word, request.TargetLanguage, ct);

                var changeAndTranslationResult = result switch
                {
                    TranslationResult.Success s => await UpdateVocabularyEntryAndChangeCurrentLanguage(
                        request, sourceEntry, s.Definition,
                        s.AdditionalInfo, s.Example, user, ct),
                    TranslationResult.Failure => new ChangeAndTranslationResult.TranslationFailure(),
                    TranslationResult.PromptLengthExceeded => new ChangeAndTranslationResult.PromptLengthExceeded(),
                    _ => throw new ArgumentOutOfRangeException()
                };

                var otherVocabulary = await context.VocabularyEntries
                    .Where(entry => entry.UserId == request.User.Id
                                    && entry.Language == sourceEntry.Language
                                    && entry.Word.Equals(sourceEntry.Word.ToLowerInvariant()))
                    .ToListAsync(ct);

                context.VocabularyEntries.RemoveRange(otherVocabulary);
                await context.SaveChangesAsync(ct);
                
                await transaction.CommitAsync(ct);
                return changeAndTranslationResult;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
        }

        private async Task<ChangeAndTranslationResult> UpdateVocabularyEntryAndChangeCurrentLanguage(
            TranslateAndDeleteVocabulary request,
            VocabularyEntry sourceEntry,
            string definition,
            string additionalInfo,
            string example,
            User user,
            CancellationToken ct)
        {
            var updatedAtUtc = DateTime.UtcNow;
            sourceEntry.Word = sourceEntry.Word.ToLowerInvariant();
            sourceEntry.Definition = definition.ToLowerInvariant();
            sourceEntry.AdditionalInfo = additionalInfo.ToLowerInvariant();
            sourceEntry.Example = example;
            sourceEntry.UpdatedAtUtc = updatedAtUtc;
            sourceEntry.Language = request.TargetLanguage;

            context.VocabularyEntries.Update(sourceEntry);

            user.Settings.CurrentLanguage = request.TargetLanguage;
            context.UsersSettings.Update(user.Settings);

            await context.SaveChangesAsync(ct);

            return new ChangeAndTranslationResult.TranslationSuccess(
                definition,
                additionalInfo,
                example,
                request.VocabularyEntryId);
        }
    }
}

public abstract record ChangeAndTranslationResult
{
    public sealed record TranslationSuccess(
        string Definition,
        string AdditionalInfo,
        string Example,
        Guid VocabularyEntryId) : ChangeAndTranslationResult;

    public sealed record PromptLengthExceeded : ChangeAndTranslationResult;

    public sealed record TranslationFailure : ChangeAndTranslationResult;

    public sealed record NoActionNeeded : ChangeAndTranslationResult;
}