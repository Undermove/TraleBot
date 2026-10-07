using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class BroadcastCampaignConfiguration : IEntityTypeConfiguration<BroadcastCampaign>
{
    public void Configure(EntityTypeBuilder<BroadcastCampaign> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Key).HasMaxLength(48).IsRequired();
        builder.HasIndex(c => c.Key).IsUnique();
        builder.Property(c => c.Message).IsRequired();
        builder.Property(c => c.ButtonText).HasMaxLength(64);
        builder.Property(c => c.ButtonQuery).HasMaxLength(256);
    }
}

public class BroadcastDeliveryConfiguration : IEntityTypeConfiguration<BroadcastDelivery>
{
    public void Configure(EntityTypeBuilder<BroadcastDelivery> builder)
    {
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Error).HasMaxLength(500);
        // One message per campaign per user — whatever is retried, re-run or double-clicked.
        builder.HasIndex(d => new { d.CampaignId, d.UserId }).IsUnique();
        builder.HasIndex(d => new { d.CampaignId, d.Status });
        builder.HasOne<BroadcastCampaign>().WithMany().HasForeignKey(d => d.CampaignId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(d => d.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
