using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.VocabularyEntries.Commands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguage: IRequest<ChangeAndTranslationResult>
{
    public required User User { get; init; }
    public required Language TargetLanguage { get; init; }
    public required Guid VocabularyEntryId { get; init; }

    public class Handler(
        ITraleDbContext context,
        IParsingUniversalTranslator parsingUniversalTranslator,
        IParsingEnglishTranslator parsingEnglishTranslator,
        IAiTranslationService aiTranslationService)
        : IRequestHandler<TranslateToAnotherLanguageAndChangeCurrentLanguage, ChangeAndTranslationResult>
    {
        public async Task<ChangeAndTranslationResult> Handle(TranslateToAnotherLanguageAndChangeCurrentLanguage request, CancellationToken ct)
        {
            var user = request.User;
            object?[] keyValues = { request.VocabularyEntryId };
            var sourceEntry = await context.VocabularyEntries.FindAsync(keyValues, cancellationToken: ct);

            if (!request.User.IsActivePremium())
            {
                return new ChangeAndTranslationResult.PremiumRequired(user.Settings.CurrentLanguage, request.TargetLanguage, request.VocabularyEntryId);
            }
            
            if (sourceEntry == null)
            {
                throw new ApplicationException("original entry not found");
            }
            
            var duplicate = await context.VocabularyEntries
                .SingleOrDefaultAsync(entry => entry.UserId == request.User.Id
                                               && entry.Language == request.TargetLanguage
                                               && entry.Word.Equals(sourceEntry.Word.ToLowerInvariant()), 
                    cancellationToken: ct);

            if(duplicate != null)
            {
                return new ChangeAndTranslationResult.TranslationExists(
                    duplicate.Definition, 
                    duplicate.AdditionalInfo,
                    duplicate.Example,
                    duplicate.Id);
            }
            
            return request.TargetLanguage switch
            {
                Language.English => await TranslateByEnglishTranslationFlow(request, ct, sourceEntry, user),
                _ => await TranslateByGeorgianTranslationFlow(request, ct, sourceEntry, user)
            }; 
        }

        private async Task<ChangeAndTranslationResult> TranslateByGeorgianTranslationFlow(
            TranslateToAnotherLanguageAndChangeCurrentLanguage request,
            CancellationToken ct, VocabularyEntry sourceEntry,
            User user)
        {
            var result = await parsingUniversalTranslator.TranslateAsync(sourceEntry.Word, request.TargetLanguage, ct);
            return result switch
            {
                TranslationResult.Success s =>
                    await UpdateVocabularyEntryAndChangeCurrentLanguage(request,
                        sourceEntry,
                        s.Definition,
                        s.AdditionalInfo,
                        s.Example,
                        user, ct),
                TranslationResult.Failure => new ChangeAndTranslationResult.TranslationFailure(),
                _ => throw new ArgumentOutOfRangeException()
            };
        }

        private async Task<ChangeAndTranslationResult> TranslateByEnglishTranslationFlow(TranslateToAnotherLanguageAndChangeCurrentLanguage request,
            CancellationToken ct, VocabularyEntry sourceEntry, User user)
        {
            var parsingTranslationResult = await parsingEnglishTranslator.TranslateAsync(sourceEntry.Word, ct);
            if (parsingTranslationResult is TranslationResult.Success success)
            {
                return await UpdateVocabularyEntryAndChangeCurrentLanguage(request, sourceEntry,
                    success.Definition, success.AdditionalInfo,
                    success.Example, user, ct);
            }
            
            var result = await aiTranslationService.TranslateAsync(sourceEntry.Word, user.Settings.CurrentLanguage, ct);
            return result switch
            {
                TranslationResult.Success s => await UpdateVocabularyEntryAndChangeCurrentLanguage(
                    request, sourceEntry, s.Definition,
                    s.AdditionalInfo, s.Example, user, ct),
                TranslationResult.Failure => new ChangeAndTranslationResult.TranslationFailure(),
                TranslationResult.PromptLengthExceeded => new ChangeAndTranslationResult.PromptLengthExceeded(),
                _ => throw new ArgumentOutOfRangeException()
            };
        }

        private async Task<ChangeAndTranslationResult> UpdateVocabularyEntryAndChangeCurrentLanguage(
            TranslateToAnotherLanguageAndChangeCurrentLanguage request,
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

            // var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = user.VocabularyEntries.Count };
            // await _achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

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

    public sealed record TranslationExists(
        string Definition,
        string AdditionalInfo,
        string Example,
        Guid VocabularyEntryId) : ChangeAndTranslationResult;

    public sealed record PromptLengthExceeded : ChangeAndTranslationResult;

    public sealed record TranslationFailure : ChangeAndTranslationResult;

    public sealed record PremiumRequired(Language CurrentLanguage, Language TargetLanguage, Guid VocabularyEntryId) : ChangeAndTranslationResult;
}