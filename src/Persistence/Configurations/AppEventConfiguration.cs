using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class AppEventConfiguration : IEntityTypeConfiguration<AppEvent>
{
    public void Configure(EntityTypeBuilder<AppEvent> builder)
    {
        builder.ToTable("AppEvents");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Event).HasMaxLength(32).IsRequired();
        builder.Property(e => e.Target).HasMaxLength(32);
        builder.Property(e => e.Platform).HasMaxLength(16);
        builder.Property(e => e.StartParam).HasMaxLength(64);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Opens and screens over a period; a person's own trail (and the per-user daily cap).
        builder.HasIndex(e => new { e.Event, e.CreatedAtUtc });
        builder.HasIndex(e => new { e.UserId, e.CreatedAtUtc });
    }
}
