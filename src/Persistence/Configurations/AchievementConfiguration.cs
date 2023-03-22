using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class AchievementConfiguration : IEntityTypeConfiguration<Achievement>
{
    public void Configure(EntityTypeBuilder<Achievement> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.AchievementTypeId).IsRequired();
        builder.Property(a => a.UserId).IsRequired();
        builder.HasOne(a => a.User)
            .WithMany(u => u.Achievements)
            .HasForeignKey(a => a.UserId);
        builder.Property(a => a.DateAddedUtc).IsRequired().ValueGeneratedOnAdd();
    }
}