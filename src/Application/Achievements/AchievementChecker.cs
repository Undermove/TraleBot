namespace Application.Achievements;

public interface IAchievementChecker<out T>
{
    public string Icon { get; }
    public string Name { get; }
    public string Description { get; }
    public bool CheckAchievement(object entity);
}