using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class QuizQuestionConfiguration : IEntityTypeConfiguration<QuizQuestion>
{
    public void Configure(EntityTypeBuilder<QuizQuestion> builder)
    {
        builder
            .HasDiscriminator<string>("QuestionType")
            .HasValue<QuizQuestionWithTypeAnswer>(nameof(QuizQuestionWithTypeAnswer))
            .HasValue<QuizQuestionWithVariants>(nameof(QuizQuestionWithVariants));
        builder.HasKey(q => q.Id);
        builder.Property(q => q.Question).IsRequired();
        builder.Property(q => q.Answer).IsRequired();
        builder.Property(q => q.OrderInQuiz).HasDefaultValue(0).IsRequired();
        builder.HasOne(q => q.VocabularyEntry)
            .WithMany(v => v.QuizQuestions)
            .HasForeignKey(q => q.VocabularyEntryId);
    }
}