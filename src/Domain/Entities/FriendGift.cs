// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
#pragma warning disable CS8618
namespace Domain.Entities;

/// <summary>
/// A gift for a friend that dropped out of the gift of the day: a one-time link that gives
/// <see cref="Days"/> days of full access to whoever opens it first. A person can take such a gift
/// only once in their life (unique <see cref="RecipientUserId"/>), so days cannot be piled onto
/// one account — the giver has to find somebody else.
/// </summary>
public class FriendGift
{
    public Guid Id { get; set; }

    /// <summary>What goes into the link: <c>t.me/&lt;bot&gt;?start=gift_&lt;Code&gt;</c>.</summary>
    public string Code { get; set; }

    public Guid GiverUserId { get; set; }

    public int Days { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    /// <summary>Who took it; null while nobody has.</summary>
    public Guid? RecipientUserId { get; set; }

    public DateTime? ActivatedAtUtc { get; set; }
}
