using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class SharedQuizConfiguration : IEntityTypeConfiguration<SharedQuiz>
{
    public void Configure(EntityTypeBuilder<SharedQuiz> builder)
    {
        builder.Property(ve => ve.CreatedByUserName).IsRequired().ValueGeneratedOnAdd();
        builder.Property(ve => ve.CreatedByUserScore).IsRequired().HasDefaultValue(0);
    }
}