// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
#pragma warning disable CS8618
namespace Domain.Entities;

public class NotificationTrigger
{
    public Guid Id { get; set; }
    public long UserId { get; set; }
    public string Source { get; set; }
    public DateTime LastSentAt { get; set; }
    public string? Variant { get; set; }
    public User? User { get; set; }
}
