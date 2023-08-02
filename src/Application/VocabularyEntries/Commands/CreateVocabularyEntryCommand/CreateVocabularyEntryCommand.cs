using System.Text.RegularExpressions;
using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using MediatR;

namespace Application.VocabularyEntries.Commands.CreateVocabularyEntryCommand;

public class CreateVocabularyEntryCommand : IRequest<CreateVocabularyEntryResult>
{
    public Guid UserId { get; init; }
    public string? Word { get; init; }
    public string? Definition { get; init; }

    public class Handler : IRequestHandler<CreateVocabularyEntryCommand, CreateVocabularyEntryResult>
    {
        private readonly IParsingTranslationService _parsingTranslationService;
        private readonly IAiTranslationService _aiTranslationService;
        private readonly ITraleDbContext _context;
        private readonly IAchievementsService _achievementService;

        public Handler(IParsingTranslationService parsingTranslationService,
            ITraleDbContext context,
            IAchievementsService achievementService, 
            IAiTranslationService aiTranslationService)
        {
            _parsingTranslationService = parsingTranslationService;
            _context = context;
            _achievementService = achievementService;
            _aiTranslationService = aiTranslationService;
        }

        public async Task<CreateVocabularyEntryResult> Handle(CreateVocabularyEntryCommand request, CancellationToken ct)
        {
            var user = await GetUser(request, ct);

            if (IsContainsEmoji(request.Word!))
            {
                return new CreateVocabularyEntryResult(TranslationStatus.Emojis, string.Empty, string.Empty,
                    string.Empty, Guid.Empty);
            }
            
            var duplicate = user!.VocabularyEntries
                .SingleOrDefault(entry => entry.Word.Equals(request.Word, StringComparison.InvariantCultureIgnoreCase));
            if(duplicate != null)
            {
                return new CreateVocabularyEntryResult(
                    TranslationStatus.ReceivedFromVocabulary, 
                    duplicate.Definition, 
                    duplicate.AdditionalInfo,
                    duplicate.Example,
                    duplicate.Id);
            }
            
            if (request.Definition != null)
            {
                return await CreateManualVocabularyEntry(request, ct, user);
            }

            var parsingTranslationResult = await _parsingTranslationService.TranslateAsync(request.Word, ct);

            if (parsingTranslationResult.IsSuccessful)
            {
                return await CreateVocabularyEntryResult(request, ct, parsingTranslationResult.Definition, parsingTranslationResult.AdditionalInfo, parsingTranslationResult.Example, user);
            }
            
            if (user.IsActivePremium())
            {
                var result = await _aiTranslationService.TranslateAsync(request.Word, ct);
                if (!result.IsSuccessful)
                {
                    return new CreateVocabularyEntryResult(TranslationStatus.CantBeTranslated, "","", "", Guid.Empty);
                }

                return await CreateVocabularyEntryResult(request, ct, result.Definition, result.AdditionalInfo, result.Example, user);
            }
            
            return !user.IsActivePremium() 
                ? new CreateVocabularyEntryResult(TranslationStatus.SuggestPremium, "","", "", Guid.Empty) 
                : new CreateVocabularyEntryResult(TranslationStatus.CantBeTranslated, "","", "", Guid.Empty);
        }

        private async Task<CreateVocabularyEntryResult> CreateManualVocabularyEntry(CreateVocabularyEntryCommand request, CancellationToken ct, User user)
        {
            var manualTranslationTrigger = new ManualTranslationTrigger();
            await _achievementService.AssignAchievements(manualTranslationTrigger, user.Id, ct);

            return await CreateVocabularyEntryResult(request, ct, request.Definition!, request.Definition!, "", user);
        }

        private async Task<CreateVocabularyEntryResult> CreateVocabularyEntryResult(CreateVocabularyEntryCommand request, CancellationToken ct,
            string definition, string additionalInfo, string example, User user)
        {
            var entryId = Guid.NewGuid();
            var vocabularyEntry = new VocabularyEntry
            {
                Id = entryId,
                Word = request.Word!.ToLowerInvariant(),
                Definition = definition.ToLowerInvariant(),
                AdditionalInfo = additionalInfo.ToLowerInvariant(),
                Example = example,
                UserId = request.UserId,
                DateAdded = DateTime.UtcNow
            };

            await _context.VocabularyEntries.AddAsync(vocabularyEntry, ct);

            await _context.SaveChangesAsync(ct);

            var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = user.VocabularyEntries.Count };
            await _achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            return new CreateVocabularyEntryResult(
                TranslationStatus.Translated,
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

        private async Task<User?> GetUser(CreateVocabularyEntryCommand request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            var user = await _context.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                throw new ApplicationException($"User {request.UserId} not found");
            }

            await _context.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            return user;
        }
    }
}