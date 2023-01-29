using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        builder.Property(u => u.TelegramId).IsRequired();
        builder.Property(u => u.RegisteredAt).IsRequired().ValueGeneratedOnAdd();
        builder.HasMany(u => u.VocabularyEntries)
            .WithOne(ve => ve.User)
            .HasForeignKey(ve => ve.UserId);
    }
}