using Application.Common;
using MediatR;

namespace Application.VocabularyEntries.Commands;

public class RemoveVocabularyEntryCommand : IRequest
{
    public Guid VocabularyEntryId { get; set; }
    
    public class Handler : IRequestHandler<RemoveVocabularyEntryCommand>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<Unit> Handle(RemoveVocabularyEntryCommand request, CancellationToken ct)
        {
            var entry = await _dbContext.VocabularyEntries.FindAsync(request.VocabularyEntryId);
            if (entry != null)
            {
                _dbContext.VocabularyEntries.Remove(entry);
            }
            await _dbContext.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }
}