namespace Domain.Entities;

public class UserSettings
{
    public required Guid Id { get; set; }
    public required Guid UserId { get; set; }
    public virtual User User { get; set; }
    public required Language CurrentLanguage { get; set; }
}