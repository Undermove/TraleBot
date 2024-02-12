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
        builder.Property(u => u.RegisteredAtUtc).IsRequired().ValueGeneratedOnAdd();
        builder.Property(u => u.InitialLanguageSet).IsRequired();
        builder.Property(u => u.IsActive).HasDefaultValue(true).IsRequired();
        builder.HasOne(u => u.Settings) // User has one UnitSettings
            .WithOne(settings => settings.User)
            .HasForeignKey<UserSettings>(us => us.UserId)
            .IsRequired();
        builder.HasMany(u => u.VocabularyEntries)
            .WithOne(ve => ve.User)
            .HasForeignKey(ve => ve.UserId);
    }
}