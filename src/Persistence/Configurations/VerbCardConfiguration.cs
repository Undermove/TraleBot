using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class VerbCardConfiguration : IEntityTypeConfiguration<VerbCard>
{
    public void Configure(EntityTypeBuilder<VerbCard> builder)
    {
        builder.HasKey(vc => vc.Id);
        builder.Property(vc => vc.Question).IsRequired();
        builder.Property(vc => vc.QuestionGeorgian).IsRequired();
        builder.Property(vc => vc.CorrectAnswer).IsRequired();
        builder.Property(vc => vc.IncorrectOptions).IsRequired();
        builder.Property(vc => vc.Explanation).IsRequired();
        builder.Property(vc => vc.ExerciseType).IsRequired();
        builder.Property(vc => vc.TimeFormId).IsRequired();
        
        builder.HasOne(vc => vc.Verb)
            .WithMany(v => v.Cards)
            .HasForeignKey(vc => vc.VerbId);
        
        builder.HasMany<StudentVerbProgress>()
            .WithOne(sp => sp.VerbCard)
            .HasForeignKey(sp => sp.VerbCardId)
            .OnDelete(DeleteBehavior.Cascade);
        
        builder.HasIndex(vc => new { vc.VerbId, vc.ExerciseType });
    }
}