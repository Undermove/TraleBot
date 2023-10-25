using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class UserSettingsConfiguration : IEntityTypeConfiguration<UserSettings>
{
    public void Configure(EntityTypeBuilder<UserSettings> builder)
    {
        builder
            .HasKey(us => us.Id);

        builder
            .Property(us => us.CurrentLanguage)
            .HasDefaultValue(Language.English)
            .IsRequired();
    }
}