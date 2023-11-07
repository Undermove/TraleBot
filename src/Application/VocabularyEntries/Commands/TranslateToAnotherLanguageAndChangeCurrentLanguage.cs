using Application.Common;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.VocabularyEntries.Commands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguage: IRequest<OneOf<TranslationSuccess, TranslationExists, SuggestPremium, TranslationFailure>>
{
    public required User User { get; init; }
    public required string Word { get; init; }
    public required Language TargetLanguage { get; init; }

    public class Handler : IRequestHandler<TranslateToAnotherLanguageAndChangeCurrentLanguage, OneOf<TranslationSuccess, TranslationExists, SuggestPremium, TranslationFailure>>
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

        public async Task<OneOf<TranslationSuccess, TranslationExists, SuggestPremium, TranslationFailure>> Handle(TranslateToAnotherLanguageAndChangeCurrentLanguage request, CancellationToken ct)
        {
            var user = request.User;
            
            var duplicate = await _context.VocabularyEntries
                .SingleOrDefaultAsync(entry => entry.UserId == request.User.Id
                                               && entry.Language == request.TargetLanguage
                                               && entry.Word.Equals(request.Word), cancellationToken: ct);

            if(duplicate != null)
            {
                return new TranslationExists(
                    duplicate.Definition, 
                    duplicate.AdditionalInfo,
                    duplicate.Example,
                    duplicate.Id);
            }
            
            if (request.TargetLanguage != Language.English)
            {
                var result = await _parsingUniversalTranslator.TranslateAsync(request.Word, user.Settings.CurrentLanguage, ct);
                return result.IsSuccessful 
                    ? await CreateVocabularyEntryAndChangeCurrentLanguage(request, ct, result.Definition, result.AdditionalInfo, result.Example, user) 
                    : new TranslationFailure();
            }
            
            var parsingTranslationResult = await _parsingTranslationService.TranslateAsync(request.Word, ct);

            if (parsingTranslationResult.IsSuccessful)
            {
                return await CreateVocabularyEntryAndChangeCurrentLanguage(request, ct, parsingTranslationResult.Definition, parsingTranslationResult.AdditionalInfo, parsingTranslationResult.Example, user);
            }
            
            if (user.IsActivePremium())
            {
                var result = await _aiTranslationService.TranslateAsync(request.Word, user.Settings.CurrentLanguage, ct);
                if (!result.IsSuccessful)
                {
                    return new TranslationFailure();
                }

                return await CreateVocabularyEntryAndChangeCurrentLanguage(request, ct, result.Definition, result.AdditionalInfo, result.Example, user);
            }
            
            return !user.IsActivePremium() 
                ? new SuggestPremium() 
                : new TranslationFailure();
        }
        
        private async Task<TranslationSuccess> CreateVocabularyEntryAndChangeCurrentLanguage(
            TranslateToAnotherLanguageAndChangeCurrentLanguage request, 
            CancellationToken ct,
            string definition, 
            string additionalInfo, 
            string example, 
            User user)
        {
            var entryId = Guid.NewGuid();
            var dateAddedUtc = DateTime.UtcNow;
            var vocabularyEntry = new VocabularyEntry
            {
                Id = entryId,
                Word = request.Word!.ToLowerInvariant(),
                Definition = definition.ToLowerInvariant(),
                AdditionalInfo = additionalInfo.ToLowerInvariant(),
                Example = example,
                UserId = user.Id,
                DateAddedUtc = dateAddedUtc,
                UpdatedAtUtc = dateAddedUtc,
                Language = request.TargetLanguage
            };

            await _context.VocabularyEntries.AddAsync(vocabularyEntry, ct);
            
            user.Settings.CurrentLanguage = request.TargetLanguage;
            _context.UsersSettings.Update(user.Settings);
            
            await _context.SaveChangesAsync(ct);

            // var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = user.VocabularyEntries.Count };
            // await _achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            return new TranslationSuccess(
                definition,
                additionalInfo,
                example,
                entryId);
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

public record SuggestPremium;

public record TranslationFailure;