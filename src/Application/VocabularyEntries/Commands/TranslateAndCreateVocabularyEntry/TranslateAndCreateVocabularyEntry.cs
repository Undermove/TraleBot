using System.Text.RegularExpressions;
using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Extensions;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;

public class TranslateAndCreateVocabularyEntry : IRequest<OneOf<TranslationSuccess, TranslationExists, EmojiDetected, TranslationFailure>>
{
    public required Guid UserId { get; init; }
    public required string Word { get; init; }

    public class Handler : IRequestHandler<TranslateAndCreateVocabularyEntry, OneOf<TranslationSuccess, TranslationExists, EmojiDetected, TranslationFailure>>
    {
        private readonly IParsingTranslationService _parsingTranslationService;
        private readonly IParsingUniversalTranslator _parsingUniversalTranslator;
        private readonly IAiTranslationService _aiTranslationService;
        private readonly ITraleDbContext _context;
        private readonly IAchievementsService _achievementService;

        public Handler(IParsingTranslationService parsingTranslationService,
            IParsingUniversalTranslator parsingUniversalTranslator,
            ITraleDbContext context,
            IAchievementsService achievementService, 
            IAiTranslationService aiTranslationService)
        {
            _parsingTranslationService = parsingTranslationService;
            _parsingUniversalTranslator = parsingUniversalTranslator;
            _context = context;
            _achievementService = achievementService;
            _aiTranslationService = aiTranslationService;
        }

        public async Task<OneOf<TranslationSuccess, TranslationExists, EmojiDetected, TranslationFailure>> Handle(TranslateAndCreateVocabularyEntry request, CancellationToken ct)
        {
            var user = await GetUser(request, ct);

            if (IsContainsEmoji(request.Word))
            {
                return new EmojiDetected();
            }
            
            var wordLanguage = request.Word.DetectLanguage();
            
            var duplicate = await _context.VocabularyEntries
                .SingleOrDefaultAsync(entry => entry.UserId == request.UserId
                                               && (entry.Language == user.Settings.CurrentLanguage || entry.Language == wordLanguage)
                                               && entry.Word.Equals(request.Word), ct);
            
            if(duplicate != null)
            {
                return new TranslationExists(
                    duplicate.Definition, 
                    duplicate.AdditionalInfo,
                    duplicate.Example,
                    duplicate.Id);
            }

            TranslationResult? result;
            if (user.Settings.CurrentLanguage == Language.Georgian || wordLanguage == Language.Georgian)
            {
                var translationLanguage = wordLanguage == Language.Russian ? user.Settings.CurrentLanguage : wordLanguage;
                result = await _parsingUniversalTranslator.TranslateAsync(request.Word, translationLanguage, ct);
                return result.IsSuccessful 
                    ? await CreateVocabularyEntryResult(request, ct, result.Definition, result.AdditionalInfo, result.Example, user) 
                    : new TranslationFailure();
            }
            
            var parsingTranslationResult = await _parsingTranslationService.TranslateAsync(request.Word, ct);

            if (parsingTranslationResult.IsSuccessful)
            {
                return await CreateVocabularyEntryResult(request, ct, parsingTranslationResult.Definition, parsingTranslationResult.AdditionalInfo, parsingTranslationResult.Example, user);
            }
            
            result = await _aiTranslationService.TranslateAsync(request.Word, user.Settings.CurrentLanguage, ct);
            
            return result.IsSuccessful
                ? await CreateVocabularyEntryResult(request, ct, result.Definition, result.AdditionalInfo, result.Example, user)
                : new TranslationFailure();
        }

        private async Task<TranslationSuccess> CreateVocabularyEntryResult(TranslateAndCreateVocabularyEntry request, CancellationToken ct,
            string definition, string additionalInfo, string example, User user)
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
                UserId = request.UserId,
                DateAddedUtc = dateAddedUtc,
                UpdatedAtUtc = dateAddedUtc,
                Language = user.Settings.CurrentLanguage
            };

            await _context.VocabularyEntries.AddAsync(vocabularyEntry, ct);

            await _context.SaveChangesAsync(ct);

            var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = user.VocabularyEntries.Count };
            await _achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            return new TranslationSuccess(
                definition,
                additionalInfo,
                example,
                entryId);
        }

        private static bool IsContainsEmoji(string input)
        {
            string emojiPattern = @"\p{Cs}";
            return Regex.IsMatch(input, emojiPattern);
        }

        private async Task<User> GetUser(TranslateAndCreateVocabularyEntry request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            var user = await _context.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                throw new ApplicationException($"User {request.UserId} not found");
            }

            await _context.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            await _context.Entry(user).Reference(nameof(user.Settings)).LoadAsync(ct);
            return user;
        }
    }
}