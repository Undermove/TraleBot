namespace Domain.Entities;

public class Achievement
{
    public Guid Id { get; set; }
    public string Icon { get; set; }
    public string Name { get; set; }
    public string UnlockConditionsDescription { get; set; }
    public bool IsUnlocked { get; set; }
}