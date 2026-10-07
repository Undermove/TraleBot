using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class QueuedTranslationConfiguration : IEntityTypeConfiguration<QueuedTranslation>
{
    public void Configure(EntityTypeBuilder<QueuedTranslation> builder)
    {
        builder.ToTable("QueuedTranslations");
        builder.HasKey(q => q.Id);

        builder.Property(q => q.Word).HasColumnType("text");
        builder.Property(q => q.WordKey).HasColumnType("text");
        builder.Property(q => q.Outcome).HasMaxLength(32);
        builder.Property(q => q.Stage).HasMaxLength(64);
        builder.Ignore(q => q.IsFinished);

        builder.HasOne<User>().WithMany().HasForeignKey(q => q.UserId).OnDelete(DeleteBehavior.Cascade);

        // The mini-app's status lookup: the latest record of this user's word.
        builder.HasIndex(q => new { q.UserId, q.WordKey, q.CreatedAtUtc });
        // Clearing old records.
        builder.HasIndex(q => q.CreatedAtUtc);
    }
}
