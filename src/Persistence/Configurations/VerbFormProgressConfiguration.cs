using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class VerbFormProgressConfiguration : IEntityTypeConfiguration<VerbFormProgress>
{
    public void Configure(EntityTypeBuilder<VerbFormProgress> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Tense).HasMaxLength(32);

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.Verb)
            .WithMany()
            .HasForeignKey(p => p.VerbId)
            .OnDelete(DeleteBehavior.Cascade);

        // One row per cell of the paradigm; also what makes a replayed save an update, not a duplicate.
        builder.HasIndex(p => new { p.UserId, p.VerbId, p.Tense, p.Person }).IsUnique();

        // "What is due for this user".
        builder.HasIndex(p => new { p.UserId, p.NextDueAtUtc });
    }
}
