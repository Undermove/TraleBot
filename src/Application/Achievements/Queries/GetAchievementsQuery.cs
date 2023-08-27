using Application.Common;
using Application.Common.Interfaces.Achievements;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Achievements.Queries;

public class GetAchievementsQuery : IRequest<AchievementsListVm>
{
    public required Guid UserId { get; init; }

    public class Handler : IRequestHandler<GetAchievementsQuery, AchievementsListVm>
    {
        private readonly ITraleDbContext _context;
        private readonly IEnumerable<IAchievementChecker<IAchievementTrigger>> _achievementCheckers;
        
        public Handler(ITraleDbContext context, IEnumerable<IAchievementChecker<IAchievementTrigger>> achievementCheckers)
        {
            _context = context;
            _achievementCheckers = achievementCheckers;
        }

        public async Task<AchievementsListVm> Handle(GetAchievementsQuery request, CancellationToken cancellationToken)
        {
            var unlockedAchievements = await _context.Achievements
                .Where(a => a.UserId == request.UserId)
                .Select(achievement => achievement.AchievementTypeId)
                .ToListAsync(cancellationToken: cancellationToken);

            var allAchievements = _achievementCheckers.Select(checker => new AchievementVm
            {
                Name = checker.Name,
                Description = checker.Description,
                Icon = checker.Icon,
                IsUnlocked = unlockedAchievements.Contains(checker.AchievementTypeId)
            }).ToList();

            var allVocabularyEntries = await _context.VocabularyEntries
                .Where(entry => entry.UserId == request.UserId)
                .ToListAsync(cancellationToken);
            
            var masteredInForwardDirectionProgress = allVocabularyEntries
                .Count(entry => entry.UserId == request.UserId && 
                                entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection);

            var masteredInBothDirectionsProgress = allVocabularyEntries
                .Count(entry => entry.UserId == request.UserId &&
                                entry.GetMasteringLevel() == MasteringLevel.MasteredInBothDirections);
            
            var result = new AchievementsListVm
            {
                Achievements = allAchievements,
                VocabularyEntriesCount = allVocabularyEntries.Count,
                MasteredInForwardDirectionProgress = masteredInForwardDirectionProgress + masteredInBothDirectionsProgress,
                MasteredInBothDirectionProgress = masteredInBothDirectionsProgress
            };
            return result;
        }
    }
}