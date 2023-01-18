using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using MediatR;

namespace Application.VocabularyEntries.Commands;

public class CreateVocabularyEntryCommand : IRequest<CreateVocabularyEntryResult>
{
    public Guid UserId { get; set; }
    public string Word { get; set; }
    
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
                .SingleOrDefault(entry => entry.Word.ToLowerInvariant() == request.Word.ToLowerInvariant());
            if(duplicate != null)
            {
                return new CreateVocabularyEntryResult(duplicate.Definition, duplicate.Id);
            }
            
            var definition = await _translationService.TranslateAsync(request.Word, ct);

            var entryId = Guid.NewGuid();
            await _context.VocabularyEntries.AddAsync(new VocabularyEntry
            {
                Id = entryId,
                Word = request.Word.ToLowerInvariant(),
                Definition = definition.ToLowerInvariant(),
                UserId = request.UserId,
                DateAdded = DateTime.UtcNow
            }, ct);
            
            await _context.SaveChangesAsync(ct);
            
            return new CreateVocabularyEntryResult(definition, entryId);
        }
    }
}