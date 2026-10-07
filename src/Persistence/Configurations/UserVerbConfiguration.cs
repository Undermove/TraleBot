using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class UserVerbConfiguration : IEntityTypeConfiguration<UserVerb>
{
    public void Configure(EntityTypeBuilder<UserVerb> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.RecentScenesJson).HasColumnType("text");

        builder.HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.Verb)
            .WithMany()
            .HasForeignKey(v => v.VerbId)
            .OnDelete(DeleteBehavior.Cascade);

        // One row per learner and verb.
        builder.HasIndex(v => new { v.UserId, v.VerbId }).IsUnique();
    }
}

public class VerbSectionVisitConfiguration : IEntityTypeConfiguration<VerbSectionVisit>
{
    public void Configure(EntityTypeBuilder<VerbSectionVisit> builder)
    {
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Source).HasMaxLength(64).IsRequired();

        builder.HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // One row per learner and source; "everyone who came by this link" reads by source.
        builder.HasIndex(v => new { v.UserId, v.Source }).IsUnique();
        builder.HasIndex(v => v.Source);
    }
}

public class VerbSessionConfiguration : IEntityTypeConfiguration<VerbSession>
{
    public void Configure(EntityTypeBuilder<VerbSession> builder)
    {
        builder.HasKey(s => s.Id);

        // The id is chosen by the mini-app.
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.PlanJson).HasColumnType("text");

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Verb)
            .WithMany()
            .HasForeignKey(s => s.VerbId)
            .OnDelete(DeleteBehavior.Cascade);

        // "The unfinished session of this verb" and "what was credited today".
        builder.HasIndex(s => new { s.UserId, s.VerbId, s.FinishedAtUtc });
        builder.HasIndex(s => new { s.UserId, s.FinishedAtUtc });
    }
}
