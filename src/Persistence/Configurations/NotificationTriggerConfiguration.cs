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

        // UserId stores the Telegram ID (long), not the User PK (Guid). No FK relationship:
        // HasPrincipalKey(TelegramId) would promote TelegramId to an alternate key, breaking
        // EF identity tracking in tests that share TelegramId values.
        //
        // Unique: one trigger row per (user, source). This is the backstop that lets
        // TryClaimNotificationTriggerAsync use INSERT … ON CONFLICT so concurrent/overlapping
        // dispatch runs can't each insert a row and double-send (incident 2026-06-17).
        builder.HasIndex(x => new { x.UserId, x.Source }).IsUnique();
    }
}
