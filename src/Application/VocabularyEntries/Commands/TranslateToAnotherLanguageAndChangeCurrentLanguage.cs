using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.VocabularyEntries.Commands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguage: IRequest<OneOf<TranslationSuccess, TranslationExists, PromptLengthExceeded, TranslationFailure>>
{
    public required User User { get; init; }
    public required Language TargetLanguage { get; init; }
    public Guid VocabularyEntryId { get; set; }

    public class Handler : IRequestHandler<TranslateToAnotherLanguageAndChangeCurrentLanguage, OneOf<TranslationSuccess, TranslationExists, PromptLengthExceeded, TranslationFailure>>
    {
        private readonly IParsingTranslationService _parsingTranslationService;
        private readonly IParsingUniversalTranslator _parsingUniversalTranslator;
        private readonly IAiTranslationService _aiTranslationService;
        private readonly ITraleDbContext _context;

        public Handler(ITraleDbContext context, IParsingUniversalTranslator parsingUniversalTranslator, IParsingTranslationService parsingTranslationService, IAiTranslationService aiTranslationService)
        {
            _context = context;
            _parsingUniversalTranslator = parsingUniversalTranslator;
            _parsingTranslationService = parsingTranslationService;
            _aiTranslationService = aiTranslationService;
        }

        public async Task<OneOf<TranslationSuccess, TranslationExists, PromptLengthExceeded, TranslationFailure>> Handle(TranslateToAnotherLanguageAndChangeCurrentLanguage request, CancellationToken ct)
        {
            var user = request.User;
            object?[] keyValues = { request.VocabularyEntryId };
            var sourceEntry = await _context.VocabularyEntries.FindAsync(keyValues, cancellationToken: ct);

            if (sourceEntry == null)
            {
                throw new ApplicationException("original entry not found");
            }
            
            var duplicate = await _context.VocabularyEntries
                .SingleOrDefaultAsync(entry => entry.UserId == request.User.Id
                                               && entry.Language == request.TargetLanguage
                                               && entry.Word.Equals(sourceEntry.Word), 
                    cancellationToken: ct);

            if(duplicate != null)
            {
                return new TranslationExists(
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

        private async Task<OneOf<TranslationSuccess, TranslationExists, PromptLengthExceeded, TranslationFailure>> TranslateByGeorgianTranslationFlow(
            TranslateToAnotherLanguageAndChangeCurrentLanguage request,
            CancellationToken ct, VocabularyEntry sourceEntry,
            User user)
        {
            var result = await _parsingUniversalTranslator.TranslateAsync(sourceEntry.Word, request.TargetLanguage, ct);
            return result switch
            {
                TranslationResult.Success s =>
                    await UpdateVocabularyEntryAndChangeCurrentLanguage(request,
                        sourceEntry,
                        s.Definition,
                        s.AdditionalInfo,
                        s.Example,
                        user, ct),
                TranslationResult.Failure => new TranslationFailure(),
                _ => throw new ArgumentOutOfRangeException()
            };
        }

        private async Task<OneOf<TranslationSuccess, TranslationExists, PromptLengthExceeded, TranslationFailure>> TranslateByEnglishTranslationFlow(TranslateToAnotherLanguageAndChangeCurrentLanguage request,
            CancellationToken ct, VocabularyEntry sourceEntry, User user)
        {
            var parsingTranslationResult = await _parsingTranslationService.TranslateAsync(sourceEntry.Word, ct);
            if (parsingTranslationResult is TranslationResult.Success success)
            {
                return await UpdateVocabularyEntryAndChangeCurrentLanguage(request, sourceEntry,
                    success.Definition, success.AdditionalInfo,
                    success.Example, user, ct);
            }
            
            var result = await _aiTranslationService.TranslateAsync(sourceEntry.Word, user.Settings.CurrentLanguage, ct);
            return result switch
            {
                TranslationResult.Success s => await UpdateVocabularyEntryAndChangeCurrentLanguage(
                    request, sourceEntry, s.Definition,
                    s.AdditionalInfo, s.Example, user, ct),
                TranslationResult.Failure => new TranslationFailure(),
                TranslationResult.PromptLengthExceeded => new PromptLengthExceeded(),
                _ => throw new ArgumentOutOfRangeException()
            };
        }

        private async Task<TranslationSuccess> UpdateVocabularyEntryAndChangeCurrentLanguage(
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
            
            _context.VocabularyEntries.Update(sourceEntry);
            
            user.Settings.CurrentLanguage = request.TargetLanguage;
            _context.UsersSettings.Update(user.Settings);
            
            await _context.SaveChangesAsync(ct);

            // var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = user.VocabularyEntries.Count };
            // await _achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            return new TranslationSuccess(
                definition,
                additionalInfo,
                example,
                request.VocabularyEntryId);
        }
    }
}

public record TranslationSuccess(
    string Definition,
    string AdditionalInfo,
    string Example,
    Guid VocabularyEntryId);

public record TranslationExists(
    string Definition,
    string AdditionalInfo,
    string Example,
    Guid VocabularyEntryId);

public record PromptLengthExceeded;

public record TranslationFailure;