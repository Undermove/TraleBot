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
        private readonly ITranslationService _translationService;
        private readonly ITraleDbContext _context;
        private readonly IAchievementsService _achievementService;

        public Handler(ITranslationService translationService,
            ITraleDbContext context,
            IAchievementsService achievementService)
        {
            _translationService = translationService;
            _context = context;
            _achievementService = achievementService;
        }

        public async Task<CreateVocabularyEntryResult> Handle(CreateVocabularyEntryCommand request, CancellationToken ct)
        {
            var user = await GetUser(request, ct);

            var duplicate = user!.VocabularyEntries
                .SingleOrDefault(entry => entry.Word.Equals(request.Word, StringComparison.InvariantCultureIgnoreCase));
            if(duplicate != null)
            {
                return new CreateVocabularyEntryResult(TranslationStatus.ReceivedFromVocabulary, duplicate.Definition, duplicate.AdditionalInfo, duplicate.Id);
            }

            string definition;
            string additionalInfo;
            string example = string.Empty;
            
            if (request.Definition != null)
            {
                definition = request.Definition;
                additionalInfo = request.Definition;

                var manualTranslationTrigger = new ManualTranslationTrigger();
                await _achievementService.AssignAchievements(manualTranslationTrigger, user.Id, ct);
            }
            else
            {
                var translationResult = await _translationService.TranslateAsync(request.Word, ct);

                definition = translationResult.Definition.ToLowerInvariant();
                additionalInfo = translationResult.AdditionalInfo.ToLowerInvariant();
                example = translationResult.Example;
                
                if (!translationResult.IsSuccessful)
                {
                    return new CreateVocabularyEntryResult(TranslationStatus.CantBeTranslated, "","", Guid.Empty);
                }
            }

            var entryId = Guid.NewGuid();
            var vocabularyEntry = new VocabularyEntry
            {
                Id = entryId,
                Word = request.Word!.ToLowerInvariant(),
                Definition = definition,
                AdditionalInfo = additionalInfo,
                Example = example,
                UserId = request.UserId,
                DateAdded = DateTime.UtcNow
            };
            
            await _context.VocabularyEntries.AddAsync(vocabularyEntry, ct);
            
            await _context.SaveChangesAsync(ct);

            var vocabularyCountTrigger = new VocabularyCountTrigger {VocabularyEntriesCount = user.VocabularyEntries.Count};
            await _achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            return new CreateVocabularyEntryResult(
                TranslationStatus.Translated, 
                definition, 
                additionalInfo,
                entryId);
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