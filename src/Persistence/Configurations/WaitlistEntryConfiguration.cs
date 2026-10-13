using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class WaitlistEntryConfiguration : IEntityTypeConfiguration<WaitlistEntry>
{
    public void Configure(EntityTypeBuilder<WaitlistEntry> builder)
    {
        builder.ToTable("WaitlistEntries");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Email).HasMaxLength(254);
        builder.Property(e => e.Language).HasMaxLength(32);
        builder.Property(e => e.Platform).HasMaxLength(32);
        builder.Property(e => e.Source).HasMaxLength(64);

        // One row per address and language: a second press of the button changes nothing.
        builder.HasIndex(e => new { e.Email, e.Language }).IsUnique();
        builder.HasIndex(e => e.CreatedAtUtc);
    }
}
