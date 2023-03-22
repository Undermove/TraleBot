using Domain.Entities;

namespace Application.Abstractions;

public interface IAchievementsService
{
    Task AssignAchievements<T>(CancellationToken ct, User user, T entity);
}