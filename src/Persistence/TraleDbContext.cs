using System.Diagnostics.CodeAnalysis;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence.Configurations;

namespace Persistence;

[SuppressMessage("ReSharper", "UnusedAutoPropertyAccessor.Global")]
public class TraleDbContext : DbContext, ITraleDbContext
{
    public TraleDbContext(DbContextOptions<TraleDbContext> options)
        : base(options)
    {
        
    }
    
    public DbSet<User> Users { get; set; } = null!;
    public DbSet<VocabularyEntry> VocabularyEntries { get; set; } = null!;
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.Entity<User>()
            .HasMany(u => u.VocabularyEntries)
            .WithOne(ve => ve.User)
            .HasForeignKey(ve => ve.UserId);

        modelBuilder.ApplyConfiguration(new VocabularyEntryConfiguration());
        modelBuilder.Entity<VocabularyEntry>()
            .Property(ve => ve.DateAdded)
            .ValueGeneratedOnAdd();
    }
}
