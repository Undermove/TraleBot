using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class TranslationCacheEntryConfiguration : IEntityTypeConfiguration<TranslationCacheEntry>
{
    public void Configure(EntityTypeBuilder<TranslationCacheEntry> builder)
    {
        builder.ToTable("TranslationCache");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Key).HasMaxLength(128);
        builder.Property(e => e.Source).HasMaxLength(32);
        builder.Property(e => e.Definition).HasColumnType("text");
        builder.Property(e => e.AdditionalInfo).HasColumnType("text");
        builder.Property(e => e.Example).HasColumnType("text");

        // The lookup; unique so that two concurrent first lookups of one word keep a single row.
        builder.HasIndex(e => new { e.Key, e.Direction }).IsUnique();
    }
}
