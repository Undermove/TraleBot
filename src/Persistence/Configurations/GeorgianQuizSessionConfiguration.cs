using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class GeorgianQuizSessionConfiguration : IEntityTypeConfiguration<GeorgianQuizSession>
{
    public void Configure(EntityTypeBuilder<GeorgianQuizSession> builder)
    {
        builder.HasKey(x => x.Id);
        
        builder.Property(x => x.Id)
            .ValueGeneratedOnAdd();
        
        builder.Property(x => x.TelegramUserId)
            .IsRequired();
        
        builder.Property(x => x.UserId)
            .IsRequired();
        
        builder.Property(x => x.LessonId)
            .IsRequired();
        
        builder.Property(x => x.QuestionsJson)
            .IsRequired()
            .HasColumnType("text");
        
        builder.Property(x => x.CurrentQuestionIndex)
            .IsRequired()
            .HasDefaultValue(0);
        
        builder.Property(x => x.CorrectAnswersCount)
            .IsRequired()
            .HasDefaultValue(0);
        
        builder.Property(x => x.IncorrectAnswersCount)
            .IsRequired()
            .HasDefaultValue(0);
        
        builder.Property(x => x.WeakVerbsJson)
            .IsRequired()
            .HasDefaultValue("[]")
            .HasColumnType("text");
        
        builder.Property(x => x.StartedAtUtc)
            .IsRequired();
        
        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();
        
        builder.Property(x => x.UpdatedAtUtc)
            .IsRequired();
        
        // Foreign key relationship
        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        
        // Index for quick lookups by TelegramUserId
        builder.HasIndex(x => x.TelegramUserId);
        
        // Index for FK lookups
        builder.HasIndex(x => x.UserId);
        
        // Index to find active sessions (by CreatedAtUtc for cleanup)
        builder.HasIndex(x => x.CreatedAtUtc);
    }
}