using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class QuizConfiguration : IEntityTypeConfiguration<Quiz>
{
    public void Configure(EntityTypeBuilder<Quiz> builder)
    {
        builder.HasKey(quiz => quiz.Id);
        builder
            .HasDiscriminator<string>("QuizType")
            .HasValue<UserQuiz>(nameof(UserQuiz))
            .HasValue<SharedQuiz>(nameof(SharedQuiz));
        builder.HasOne(quiz => quiz.User)
            .WithMany(u => u.Quizzes).HasForeignKey(quiz => quiz.UserId);
        builder.Property(ve => ve.DateStarted).IsRequired().ValueGeneratedOnAdd();
        builder.Property(ve => ve.IsCompleted).HasDefaultValue(false);
        builder.HasOne(quiz => quiz.ShareableQuiz)
            .WithOne(u => u.Quiz)
            .HasForeignKey<ShareableQuiz>(quiz => quiz.QuizId)
            .IsRequired();
    }
}