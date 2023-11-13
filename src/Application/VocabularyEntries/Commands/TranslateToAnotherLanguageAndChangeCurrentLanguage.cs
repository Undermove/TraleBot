using Application.Common;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.VocabularyEntries.Commands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguage: IRequest<OneOf<TranslationSuccess, TranslationExists, TranslationFailure>>
{
    public required User User { get; init; }
    public required Language TargetLanguage { get; init; }
    public Guid VocabularyEntryId { get; set; }

    public class Handler : IRequestHandler<TranslateToAnotherLanguageAndChangeCurrentLanguage, OneOf<TranslationSuccess, TranslationExists, TranslationFailure>>
    {
        private readonly IParsingTranslationService _parsingTranslationService;
        private readonly IParsingUniversalTranslator _parsingUniversalTranslator;
        private readonly IAiTranslationService _aiTranslationService;
        private readonly ITraleDbContext _context;
        private readonly IAchievementsService _achievementService;

        public Handler(ITraleDbContext context, IParsingUniversalTranslator parsingUniversalTranslator, IParsingTranslationService parsingTranslationService, IAiTranslationService aiTranslationService, IAchievementsService achievementService)
        {
            _context = context;
            _parsingUniversalTranslator = parsingUniversalTranslator;
            _parsingTranslationService = parsingTranslationService;
            _aiTranslationService = aiTranslationService;
            _achievementService = achievementService;
        }

        public async Task<OneOf<TranslationSuccess, TranslationExists, TranslationFailure>> Handle(TranslateToAnotherLanguageAndChangeCurrentLanguage request, CancellationToken ct)
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

            TranslationResult? result;
            if (request.TargetLanguage != Language.English)
            {
                result = await _parsingUniversalTranslator.TranslateAsync(sourceEntry.Word, user.Settings.CurrentLanguage, ct);
                return result.IsSuccessful 
                    ? await UpdateVocabularyEntryAndChangeCurrentLanguage(request, sourceEntry, result.Definition, result.AdditionalInfo, result.Example, user, ct) 
                    : new TranslationFailure();
            }
            
            var parsingTranslationResult = await _parsingTranslationService.TranslateAsync(sourceEntry.Word, ct);

            if (parsingTranslationResult.IsSuccessful)
            {
                return await UpdateVocabularyEntryAndChangeCurrentLanguage(request, sourceEntry, parsingTranslationResult.Definition, parsingTranslationResult.AdditionalInfo, parsingTranslationResult.Example, user, ct);
            }
            
            result = await _aiTranslationService.TranslateAsync(sourceEntry.Word, user.Settings.CurrentLanguage, ct);
            if (!result.IsSuccessful)
            {
                return new TranslationFailure();
            }

            return await UpdateVocabularyEntryAndChangeCurrentLanguage(request, sourceEntry, result.Definition, result.AdditionalInfo, result.Example, user, ct);
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

public record TranslationFailure;