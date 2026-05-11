using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class NotificationTriggerConfiguration : IEntityTypeConfiguration<NotificationTrigger>
{
    public void Configure(EntityTypeBuilder<NotificationTrigger> builder)
    {
        builder.HasKey(t => t.Id);
        builder.Property(t => t.UserId).IsRequired();
        builder.Property(t => t.Source).HasConversion<int>().IsRequired();
        builder.Property(t => t.NextStreakMilestone).HasDefaultValue(7).IsRequired();
        builder.Property(t => t.LastSentAt).IsRequired(false);

        builder.HasIndex(t => new { t.UserId, t.Source }).IsUnique();

        builder.HasOne(t => t.User)
            .WithMany(u => u.NotificationTriggers)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
