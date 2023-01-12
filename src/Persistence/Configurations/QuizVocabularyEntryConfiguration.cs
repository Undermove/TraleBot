using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class QuizVocabularyEntryConfiguration : IEntityTypeConfiguration<QuizVocabularyEntry>
{
    public void Configure(EntityTypeBuilder<QuizVocabularyEntry> builder)
    {
        builder
            .HasKey(q => new { q.QuizId, q.VocabularyEntryId });
        builder
            .HasOne(q => q.Quiz)
            .WithMany(q => q.QuizVocabularyEntries)
            .HasForeignKey(q => q.QuizId);
        builder
            .HasOne(q => q.VocabularyEntry)
            .WithMany(q => q.QuizVocabularyEntries)
            .HasForeignKey(q => q.VocabularyEntryId);
    }
}