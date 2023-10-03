using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class QuizQuestionWithVariantsConfiguration : IEntityTypeConfiguration<QuizQuestionWithVariants>
{
    public void Configure(EntityTypeBuilder<QuizQuestionWithVariants> builder)
    {
        builder.Property(quizQuestion => quizQuestion.Variants).IsRequired()
            .HasConversion(
                v => string.Join(',', v),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries));
    }
}