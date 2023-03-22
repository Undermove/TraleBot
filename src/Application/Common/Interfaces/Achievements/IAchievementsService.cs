using Domain.Entities;

namespace Application.Abstractions;

public interface IAchievementsService
{
    Task AssignAchievements<T>(CancellationToken ct, Guid userId, T entity);
}