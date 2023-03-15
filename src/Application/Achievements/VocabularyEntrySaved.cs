using Application.Common;
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
            if (_context.VocabularyEntries.Count(entry => entry.UserId == invoceSaved.UserId) == 10)
            {
                return Task.CompletedTask;
            }
            
            return Task.CompletedTask;
        }
    }
}