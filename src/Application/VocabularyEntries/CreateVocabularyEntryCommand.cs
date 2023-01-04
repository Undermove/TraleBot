using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using MediatR;

namespace Application.VocabularyEntries;

public class CreateVocabularyEntryCommand : IRequest<string>
{
    public Guid UserId { get; set; }
    public string Word { get; set; }
    
    public class Handler : IRequestHandler<CreateVocabularyEntryCommand, string>
    {
        private readonly ITranslationService _translationService;
        private readonly ITraleDbContext _context;

        public Handler(ITranslationService translationService, ITraleDbContext context)
        {
            _translationService = translationService;
            _context = context;
        }

        public async Task<string> Handle(CreateVocabularyEntryCommand request, CancellationToken ct)
        {
            var definition = await _translationService.TranslateAsync(request.Word, ct);
            
            await _context.VocabularyEntries.AddAsync(new VocabularyEntry
            {
                Id = Guid.NewGuid(),
                Word = request.Word,
                Definition = definition,
                UserId = request.UserId,
                DateAdded = DateTime.UtcNow
            }, ct);
            
            await _context.SaveChangesAsync(ct);
            
            return definition;
        }
    }
}