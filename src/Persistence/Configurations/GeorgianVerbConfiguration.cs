using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class GeorgianVerbConfiguration : IEntityTypeConfiguration<GeorgianVerb>
{
    public void Configure(EntityTypeBuilder<GeorgianVerb> builder)
    {
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Georgian).IsRequired();
        builder.Property(v => v.Russian).IsRequired();
        builder.Property(v => v.Difficulty).IsRequired().HasDefaultValue(1);
        builder.Property(v => v.Wave).IsRequired().HasDefaultValue(1);
        
        builder.HasMany(v => v.Cards)
            .WithOne(c => c.Verb)
            .HasForeignKey(c => c.VerbId);
        
        builder.HasIndex(v => v.Wave);
        builder.HasIndex(v => v.Difficulty);
    }
}