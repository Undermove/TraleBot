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
        builder.Ignore(c => c.IsSurvey);
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

public class UserFeedbackConfiguration : IEntityTypeConfiguration<UserFeedback>
{
    public void Configure(EntityTypeBuilder<UserFeedback> builder)
    {
        builder.ToTable("UserFeedback");
        builder.HasKey(f => f.Id);
        builder.Property(f => f.CampaignKey).HasMaxLength(48);
        builder.Property(f => f.Option).HasMaxLength(64);
        builder.Property(f => f.Text).HasMaxLength(2000);
        builder.HasIndex(f => new { f.UserId, f.Kind, f.CreatedAtUtc });
        builder.HasIndex(f => f.CreatedAtUtc);
        // One survey answer per person per campaign — pressing another button changes it.
        builder.HasIndex(f => new { f.UserId, f.CampaignKey }).IsUnique().HasFilter("\"Kind\" = 1");
        builder.HasOne<User>().WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
