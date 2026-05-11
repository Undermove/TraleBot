// ReSharper disable PropertyCanBeMadeInitOnly.Global
#pragma warning disable CS8618
namespace Domain.Entities;

public class NotificationTrigger
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public NotificationSource Source { get; set; }
    public DateTime? LastSentAt { get; set; }
    public int NextStreakMilestone { get; set; } = 7;

    public virtual User User { get; set; }
}
