using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using MediatR;

namespace Application.VocabularyEntries.Commands;

public class RemoveVocabularyEntryCommand : IRequest
{
    public required Guid VocabularyEntryId { get; init; }
    
    public class Handler : IRequestHandler<RemoveVocabularyEntryCommand>
    {
        private readonly ITraleDbContext _dbContext;
        private readonly IAchievementsService _achievementsService;

        public Handler(ITraleDbContext dbContext, IAchievementsService achievementsService)
        {
            _dbContext = dbContext;
            _achievementsService = achievementsService;
        }

        public async Task<Unit> Handle(RemoveVocabularyEntryCommand request, CancellationToken ct)
        {
            var entry = await _dbContext.VocabularyEntries.FindAsync(request.VocabularyEntryId);
            if (entry == null)
            {
                return Unit.Value;
            }
            
            _dbContext.VocabularyEntries.Remove(entry);
            await _dbContext.SaveChangesAsync(ct);
            
            await _achievementsService.AssignAchievements(new RemoveWordTrigger(), entry.UserId, ct);
            return Unit.Value;
        }
    }
}