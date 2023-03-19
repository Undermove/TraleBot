using Application.Achievements;
using Application.Common;
using Application.Common.Interfaces;
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
        private readonly IAchievementUnlocker _achievementUnlocker;

        public Handler(ITranslationService translationService,
            ITraleDbContext context,
            IAchievementUnlocker achievementUnlocker)
        {
            _translationService = translationService;
            _context = context;
            _achievementUnlocker = achievementUnlocker;
        }

        public async Task<CreateVocabularyEntryResult> Handle(CreateVocabularyEntryCommand request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            var user = await _context.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                throw new ApplicationException($"User {request.UserId} not found");
            }
            
            await _context.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            
            var duplicate = user.VocabularyEntries
                .SingleOrDefault(entry => entry.Word.Equals(request.Word, StringComparison.InvariantCultureIgnoreCase));
            if(duplicate != null)
            {
                return new CreateVocabularyEntryResult(TranslationStatus.ReceivedFromVocabulary, duplicate.Definition, duplicate.AdditionalInfo, duplicate.Id);
            }

            string definition;
            string additionalInfo;
            
            if (request.Definition != null)
            {
                definition = request.Definition;
                additionalInfo = request.Definition;
            }
            else
            {
                var translationResult = await _translationService.TranslateAsync(request.Word, ct);

                definition = translationResult.Definition.ToLowerInvariant();
                additionalInfo = translationResult.AdditionalInfo.ToLowerInvariant();
                
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
                UserId = request.UserId,
                DateAdded = DateTime.UtcNow
            };
            
            await _context.VocabularyEntries.AddAsync(vocabularyEntry, ct);
            
            await _context.SaveChangesAsync(ct);
            
            _achievementUnlocker.CheckAchievements(vocabularyEntry);
            
            
            return new CreateVocabularyEntryResult(
                TranslationStatus.Translated, 
                definition, 
                additionalInfo,
                entryId);
        }
    }
}