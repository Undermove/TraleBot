using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using MediatR;

namespace Application.VocabularyEntries.Commands;

public class RemoveVocabularyEntry : IRequest
{
    public required Guid VocabularyEntryId { get; init; }
    
    public class Handler : IRequestHandler<RemoveVocabularyEntry>
    {
        private readonly ITraleDbContext _dbContext;
        private readonly IAchievementsService _achievementsService;

        public Handler(ITraleDbContext dbContext, IAchievementsService achievementsService)
        {
            _dbContext = dbContext;
            _achievementsService = achievementsService;
        }

        public async Task Handle(RemoveVocabularyEntry request, CancellationToken ct)
        {
            var entry = await _dbContext.VocabularyEntries.FindAsync(request.VocabularyEntryId);
            if (entry == null)
            {
                return;
            }
            
            _dbContext.VocabularyEntries.Remove(entry);
            await _dbContext.SaveChangesAsync(ct);
            
            await _achievementsService.AssignAchievements(new RemoveWordTrigger(), entry.UserId, ct);
        }
    }
}