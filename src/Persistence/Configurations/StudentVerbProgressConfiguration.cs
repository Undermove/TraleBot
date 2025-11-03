using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class StudentVerbProgressConfiguration : IEntityTypeConfiguration<StudentVerbProgress>
{
    public void Configure(EntityTypeBuilder<StudentVerbProgress> builder)
    {
        builder.HasKey(sp => sp.Id);
        builder.Property(sp => sp.IntervalDays).IsRequired().HasDefaultValue(1);
        builder.Property(sp => sp.CorrectAnswersCount).IsRequired().HasDefaultValue(0);
        builder.Property(sp => sp.IncorrectAnswersCount).IsRequired().HasDefaultValue(0);
        builder.Property(sp => sp.CurrentStreak).IsRequired().HasDefaultValue(0);
        builder.Property(sp => sp.IsMarkedAsHard).IsRequired().HasDefaultValue(false);
        builder.Property(sp => sp.SessionCount).IsRequired().HasDefaultValue(0);
        builder.Property(sp => sp.DateAddedUtc).IsRequired().ValueGeneratedOnAdd();
        
        builder.HasOne(sp => sp.User)
            .WithMany(u => u.VerbProgress)
            .HasForeignKey(sp => sp.UserId);
        
        builder.HasOne(sp => sp.VerbCard)
            .WithMany()
            .HasForeignKey(sp => sp.VerbCardId)
            .OnDelete(DeleteBehavior.Restrict);
        
        builder.HasIndex(sp => new { sp.UserId, sp.NextReviewDateUtc });
        builder.HasIndex(sp => new { sp.UserId, sp.IsMarkedAsHard });
        builder.HasIndex(sp => sp.LastReviewDateUtc);
    }
}