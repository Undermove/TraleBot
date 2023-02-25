using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using MediatR;

namespace Application.VocabularyEntries.Commands.CreateVocabularyEntryCommand;

public class CreateVocabularyEntryCommand : IRequest<CreateVocabularyEntryResult>
{
    public Guid UserId { get; set; }
    public string Word { get; set; }
    public string? Definition { get; set; }

    public class Handler : IRequestHandler<CreateVocabularyEntryCommand, CreateVocabularyEntryResult>
    {
        private readonly ITranslationService _translationService;
        private readonly ITraleDbContext _context;

        public Handler(ITranslationService translationService, ITraleDbContext context)
        {
            _translationService = translationService;
            _context = context;
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
            await _context.VocabularyEntries.AddAsync(new VocabularyEntry
            {
                Id = entryId,
                Word = request.Word.ToLowerInvariant(),
                Definition = definition,
                AdditionalInfo = additionalInfo,
                UserId = request.UserId,
                DateAdded = DateTime.UtcNow
            }, ct);
            
            await _context.SaveChangesAsync(ct);
            
            return new CreateVocabularyEntryResult(
                TranslationStatus.Translated, 
                definition, 
                additionalInfo,
                entryId);
        }
    }
}