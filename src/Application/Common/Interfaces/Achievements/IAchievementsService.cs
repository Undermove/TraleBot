using Domain.Entities;

namespace Application.Abstractions;

public interface IAchievementsService
{
    Task AssignAchievements<T>(T trigger, Guid userId, CancellationToken ct);
}