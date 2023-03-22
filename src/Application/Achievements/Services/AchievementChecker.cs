namespace Application.Achievements.Services;

// ReSharper disable once UnusedTypeParameter
public interface IAchievementChecker<out T>
{
    public string Icon { get; }
    public string Name { get; }
    public string Description { get; }
    public Guid AchievementTypeId { get; }
    public bool CheckAchievement(object trigger);
}