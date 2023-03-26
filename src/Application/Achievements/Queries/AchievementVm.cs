namespace Application.Achievements.Queries;

public class AchievementVm
{
    public required string Icon { get; init; }
    public required string Name { get; init; }
    public required string Description { get; init; }
    public bool IsUnlocked { get; init; }
}