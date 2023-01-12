using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class VocabularyEntryConfiguration : IEntityTypeConfiguration<VocabularyEntry>
{
    public void Configure(EntityTypeBuilder<VocabularyEntry> builder)
    {
        builder.HasKey(ve => ve.Id);
        builder.Property(ve => ve.Word).IsRequired();
        builder.Property(ve => ve.Definition).IsRequired();
        builder.HasOne(ve => ve.User)
            .WithMany(u => u.VocabularyEntries)
            .HasForeignKey(ve => ve.UserId);
        builder.Property(ve => ve.DateAdded).IsRequired().ValueGeneratedOnAdd();
        builder.HasIndex(ve => ve.DateAdded);
    }
}