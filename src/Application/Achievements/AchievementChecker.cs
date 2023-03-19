namespace Application.Achievements;

public abstract class AchievementChecker<T>
{
    public abstract string Icon { get; }
    public abstract string Name { get; }
    public abstract string Description { get; }
    public abstract bool CheckAchievement(T entity);
}