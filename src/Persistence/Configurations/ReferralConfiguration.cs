using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class ReferralConfiguration : IEntityTypeConfiguration<Referral>
{
    public void Configure(EntityTypeBuilder<Referral> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.ActivationTrigger).HasMaxLength(64);

        // One row per (referrer, referee) — stops double-credit
        builder.HasIndex(r => new { r.ReferrerUserId, r.RefereeUserId }).IsUnique();
        // One referee can be referred by only one person
        builder.HasIndex(r => r.RefereeUserId).IsUnique();
    }
}
