using System.Text.Json;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class ShareableQuizConfiguration : IEntityTypeConfiguration<ShareableQuiz>
{
    public void Configure(EntityTypeBuilder<ShareableQuiz> builder)
    {
        builder.HasKey(sq => sq.Id);
        builder.Property(sq => sq.QuizType).IsRequired();
        builder.Property(sq => sq.DateAddedUtc).IsRequired().ValueGeneratedOnAdd();
        builder.HasOne(sq => sq.CreatedByUser)
            .WithMany(u => u.ShareableQuizzes)
            .HasForeignKey(sq => sq.CreatedByUserId);
        builder.Property(x => x.VocabularyEntriesIds)
            .HasConversion(
                v => JsonSerializer.Serialize(v, JsonSerializerOptions.Default),
                v => JsonSerializer.Deserialize<ICollection<Guid>>(v, JsonSerializerOptions.Default) ?? new List<Guid>()
            );
    }
}