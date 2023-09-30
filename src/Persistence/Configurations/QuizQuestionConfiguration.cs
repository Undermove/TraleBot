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
        builder.HasKey(quizQuestion => quizQuestion.Id);
        builder.Property(quizQuestion => quizQuestion.Question).IsRequired();
        builder.Property(quizQuestion => quizQuestion.Answer).IsRequired();
        builder.HasOne(invoice => invoice.VocabularyEntry)
            .WithMany(u => u.QuizQuestions)
            .HasForeignKey(invoice => invoice.VocabularyEntryId);
    }
}