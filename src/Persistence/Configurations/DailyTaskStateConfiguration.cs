using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class DailyTaskStateConfiguration : IEntityTypeConfiguration<DailyTaskState>
{
    public void Configure(EntityTypeBuilder<DailyTaskState> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.LastNew).HasMaxLength(16);
        builder.Property(s => s.MissedJson).HasColumnType("text");
        builder.Property(s => s.CourseJson).HasColumnType("text");
        builder.Property(s => s.TaskJson).HasColumnType("text");

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // One row per learner.
        builder.HasIndex(s => s.UserId).IsUnique();
    }
}
