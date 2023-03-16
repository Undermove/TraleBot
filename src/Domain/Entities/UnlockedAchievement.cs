namespace Domain.Entities;

public class UnlockedAchievement
{
    public Guid Id { get; set; }
    public Guid AchievementTypeId { get; set; }
    public string Icon { get; set; }
    public string Name { get; set; }
    public string UnlockConditionsDescription { get; set; }
}