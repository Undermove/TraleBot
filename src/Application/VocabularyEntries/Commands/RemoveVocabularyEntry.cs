using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using MediatR;

namespace Application.VocabularyEntries.Commands;

public class RemoveVocabularyEntry : IRequest
{
    public required Guid VocabularyEntryId { get; init; }
    
    public class Handler(ITraleDbContext dbContext, IAchievementsService achievementsService)
        : IRequestHandler<RemoveVocabularyEntry>
    {
        public async Task Handle(RemoveVocabularyEntry request, CancellationToken ct)
        {
            var entry = await dbContext.VocabularyEntries.FindAsync(request.VocabularyEntryId);
            if (entry == null)
            {
                return;
            }
            
            dbContext.VocabularyEntries.Remove(entry);
            await dbContext.SaveChangesAsync(ct);
            
            await achievementsService.AssignAchievements(new RemoveWordTrigger(), entry.UserId, ct);
        }
    }
}