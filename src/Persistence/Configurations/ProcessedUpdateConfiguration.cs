using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class ProcessedUpdateConfiguration : IEntityTypeConfiguration<ProcessedUpdate>
{
    public void Configure(EntityTypeBuilder<ProcessedUpdate> builder)
    {
        builder.HasKey(x => x.UpdateId);
        
        builder.Property(x => x.UpdateId)
            .IsRequired();
        
        builder.Property(x => x.ProcessedAt)
            .IsRequired();
        
        builder.Property(x => x.UserTelegramId)
            .IsRequired();
        
        builder.Property(x => x.RequestType)
            .IsRequired()
            .HasMaxLength(50);
        
        builder.Property(x => x.Text)
            .IsRequired()
            .HasMaxLength(1000);

        builder.HasIndex(x => x.ProcessedAt)
            .HasDatabaseName("IX_ProcessedUpdate_ProcessedAt");
    }
}