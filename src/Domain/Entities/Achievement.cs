namespace Domain.Entities;

public class Achievement
{
    public Guid Id { get; set; }
    public Guid AchievementTypeId { get; set; }
    public string Icon { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    
    public Guid UserId { get; set; }
    public User User { get; set; }
}