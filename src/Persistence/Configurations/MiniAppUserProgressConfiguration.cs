using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class MiniAppUserProgressConfiguration : IEntityTypeConfiguration<MiniAppUserProgress>
{
    public void Configure(EntityTypeBuilder<MiniAppUserProgress> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedOnAdd();

        builder.Property(x => x.UserId)
            .IsRequired();

        builder.Property(x => x.Xp)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.Streak)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.Hearts)
            .IsRequired()
            .HasDefaultValue(5);

        builder.Property(x => x.MaxHearts)
            .IsRequired()
            .HasDefaultValue(5);

        builder.Property(x => x.CompletedLessonsJson)
            .IsRequired()
            .HasColumnType("text")
            .HasDefaultValue("{}");

        builder.Property(x => x.XpSpent)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.TotalTreatsGiven)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.CreatedAtUtc).IsRequired();
        builder.Property(x => x.UpdatedAtUtc).IsRequired();

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.UserId).IsUnique();
    }
}
