using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class FriendGiftConfiguration : IEntityTypeConfiguration<FriendGift>
{
    public void Configure(EntityTypeBuilder<FriendGift> builder)
    {
        builder.HasKey(g => g.Id);
        builder.Property(g => g.Code).HasMaxLength(16).IsRequired();
        builder.HasIndex(g => g.Code).IsUnique();
        builder.HasIndex(g => g.GiverUserId);
        // One friend gift per person, ever.
        builder.HasIndex(g => g.RecipientUserId).IsUnique().HasFilter("\"RecipientUserId\" IS NOT NULL");
    }
}
