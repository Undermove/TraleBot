namespace Domain.Entities;

public class Achievement
{
    public required Guid Id { get; init; }
    public required Guid AchievementTypeId { get; init; }
    public required DateTime DateAddedUtc { get; init; }
    public required string Icon { get; init; }
    public required string Name { get; init; }
    public required string Description { get; init; }
    
    public required Guid UserId { get; init; }
    public virtual required User User { get; init; }
}