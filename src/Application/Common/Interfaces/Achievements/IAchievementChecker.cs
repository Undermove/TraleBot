namespace Application.Common.Interfaces.Achievements;

// ReSharper disable once UnusedTypeParameter
public interface IAchievementChecker<out T> where T: IAchievementTrigger
{
    public string Icon { get; }
    public string Name { get; }
    public string Description { get; }
    public Guid AchievementTypeId { get; }
    public bool CheckAchievement(object trigger);
}