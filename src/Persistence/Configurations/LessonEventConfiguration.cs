using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class LessonEventConfiguration : IEntityTypeConfiguration<LessonEvent>
{
    public void Configure(EntityTypeBuilder<LessonEvent> builder)
    {
        builder.ToTable("LessonEvents");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ModuleId).HasMaxLength(64).IsRequired();
        builder.Property(e => e.StepKind).HasMaxLength(32).IsRequired();
        builder.Property(e => e.Event).HasMaxLength(32).IsRequired();

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Funnel of one lesson over a period; a learner's own trail (and the per-user daily cap).
        builder.HasIndex(e => new { e.ModuleId, e.LessonId, e.CreatedAtUtc });
        builder.HasIndex(e => new { e.UserId, e.CreatedAtUtc });
    }
}
