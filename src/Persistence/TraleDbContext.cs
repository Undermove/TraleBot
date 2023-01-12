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
    public DbSet<Quiz> Quizzes { get; set; } = null!;
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new VocabularyEntryConfiguration());
        modelBuilder.ApplyConfiguration(new QuizConfiguration());
        modelBuilder.ApplyConfiguration(new QuizVocabularyEntryConfiguration());
    }
}
