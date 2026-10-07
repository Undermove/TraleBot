using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class VerbConfiguration : IEntityTypeConfiguration<Verb>
{
    public void Configure(EntityTypeBuilder<Verb> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.Lemma).HasMaxLength(64);
        builder.Property(v => v.Title).HasMaxLength(64);
        builder.Property(v => v.Translation).HasMaxLength(256);
        builder.Property(v => v.Kind).HasMaxLength(16);
        builder.Property(v => v.ContentHash).HasMaxLength(64);
        builder.Property(v => v.PresentJson).HasColumnType("text");
        builder.Property(v => v.CardJson).HasColumnType("text");

        builder.HasIndex(v => v.Lemma).IsUnique();

        builder.HasMany(v => v.Forms)
            .WithOne(f => f.Verb)
            .HasForeignKey(f => f.VerbId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class VerbFormConfiguration : IEntityTypeConfiguration<VerbForm>
{
    public void Configure(EntityTypeBuilder<VerbForm> builder)
    {
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Form).HasMaxLength(64);
        builder.Property(f => f.Tense).HasMaxLength(32);
        builder.Property(f => f.Meaning).HasMaxLength(128);
        builder.Property(f => f.MeaningNote).HasMaxLength(64);

        // The parse lookup: exact form → every (verb, tense, person) it can be.
        builder.HasIndex(f => f.Form);
    }
}

public class ModelBudgetDayConfiguration : IEntityTypeConfiguration<ModelBudgetDay>
{
    public void Configure(EntityTypeBuilder<ModelBudgetDay> builder)
    {
        builder.HasKey(b => b.Id);

        // One counter row per day and user (Guid.Empty = everyone).
        builder.HasIndex(b => new { b.Day, b.UserId }).IsUnique();
    }
}

public class VerbProvenanceConfiguration : IEntityTypeConfiguration<VerbProvenance>
{
    public void Configure(EntityTypeBuilder<VerbProvenance> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.AskedText).HasMaxLength(128);
        builder.Property(p => p.GeneratorModel).HasMaxLength(64);
        builder.Property(p => p.ReviewerModel).HasMaxLength(64);
        builder.Property(p => p.UnattestedFormsJson).HasColumnType("text");
        builder.Property(p => p.ReviewerReasons).HasColumnType("text");
        builder.Property(p => p.MissingTensesJson).HasColumnType("text").HasDefaultValue("[]");
        builder.Property(p => p.CompletedTensesJson).HasColumnType("text").HasDefaultValue("[]");
        builder.Property(p => p.TenseReviewsJson).HasColumnType("text").HasDefaultValue("[]");

        builder.HasIndex(p => p.VerbId).IsUnique();

        builder.HasOne(p => p.Verb)
            .WithOne()
            .HasForeignKey<VerbProvenance>(p => p.VerbId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
