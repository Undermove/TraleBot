using Application.Common;
using Domain.AchievementTypes;
using Domain.Entities;
using MediatR;

namespace Application.Achievements;

public class VocabularyEntrySaved : INotification
{
    public Guid? UserId { get; set; }

    public class Handler : INotificationHandler<VocabularyEntrySaved>
    {
        private readonly ITraleDbContext _context;

        public Handler(ITraleDbContext context)
        {
            _context = context;
        }

        public Task Handle(VocabularyEntrySaved invoceSaved, CancellationToken cancellationToken)
        {
            AdvancedSmallTalker achievement = new AdvancedSmallTalker();
            if (achievement.CheckUnlockConditions(new VocabularyEntry()))
            {
                return Task.CompletedTask;
            }
            
            return Task.CompletedTask;
        }
    }
}