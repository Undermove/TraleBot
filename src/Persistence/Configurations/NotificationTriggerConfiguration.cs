using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class NotificationTriggerConfiguration : IEntityTypeConfiguration<NotificationTrigger>
{
    public void Configure(EntityTypeBuilder<NotificationTrigger> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedOnAdd();
        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.Source).IsRequired().HasMaxLength(100);
        builder.Property(x => x.LastSentAt).IsRequired();
        builder.Property(x => x.Variant).IsRequired(false).HasMaxLength(10);

        // UserId stores the Telegram user ID (long). We intentionally avoid creating
        // an EF FK relationship via HasPrincipalKey(TelegramId) because that would
        // promote TelegramId to an alternate key, breaking EF's identity tracking
        // in tests that share TelegramId values. The column is indexed for lookup.
        builder.Ignore(x => x.User);
        builder.HasIndex(x => new { x.UserId, x.Source });
    }
}
