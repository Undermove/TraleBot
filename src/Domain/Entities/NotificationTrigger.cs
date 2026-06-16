// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
#pragma warning disable CS8618
namespace Domain.Entities;

/// <summary>
/// Records the last time a given notification (by <see cref="Source"/>) was sent to a user,
/// so the dispatch can enforce a cooldown. <see cref="UserId"/> stores the Telegram ID (long).
/// </summary>
public class NotificationTrigger
{
    public Guid Id { get; set; }
    public long UserId { get; set; }
    public string Source { get; set; }
    public DateTime LastSentAt { get; set; }
    public string? Variant { get; set; }
}
