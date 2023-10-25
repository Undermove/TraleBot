namespace Domain.Entities;

public class UserSettings
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public virtual User User { get; set; }
    public Language CurrentLanguage { get; set; }
}