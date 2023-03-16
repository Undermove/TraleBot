namespace Domain.AchievementTypes;

public abstract class AchievementTypeBase<T>
{
    public abstract Guid Id { get; }
    public abstract string Icon { get; }
    public abstract string Name { get; }
    public abstract string UnlockConditionsDescription { get; }
    public abstract bool CheckUnlockConditions(T CheckParam);
}