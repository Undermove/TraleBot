using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.HasKey(p => p.Id);

        builder.HasOne(p => p.User)
            .WithMany(u => u.Payments)
            .HasForeignKey(p => p.UserId);

        builder.Property(p => p.TelegramPaymentChargeId).IsRequired();
        builder.Property(p => p.PayloadId).IsRequired();
        builder.Property(p => p.Currency).IsRequired().HasMaxLength(8);
        builder.Property(p => p.Plan).HasConversion<int>();

        // Unique per Telegram charge id — prevents accidental duplicate records on retries.
        builder.HasIndex(p => p.TelegramPaymentChargeId).IsUnique();
        builder.HasIndex(p => p.UserId);
    }
}
