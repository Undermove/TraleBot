using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

public record WinBackCandidate(Guid UserId, long TelegramId);

public class WinBackTargetingService(ITraleDbContext db)
{
    public Task<IReadOnlyList<WinBackCandidate>> GetEligibleUsersAsync(
        DateTime cohortAfter,
        DateTime cohortBefore,
        int inactiveSinceDays,
        CancellationToken ct)
    {
        throw new NotImplementedException();
    }
}
