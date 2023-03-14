namespace Domain.Achievements;

public abstract class AchievementBase
{
    public Guid Id { get; set; }
    public string Icon { get; set; }
    public string Name { get; set; }
    public string UnlockConditionsDescription { get; set; }
    public abstract bool CheckUnlockConditions();
}