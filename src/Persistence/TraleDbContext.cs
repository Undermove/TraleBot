using System.Diagnostics.CodeAnalysis;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
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
    public DbSet<UserSettings> UsersSettings { get; set; } = null!;
    public DbSet<VocabularyEntry> VocabularyEntries { get; set; } = null!;
    public DbSet<Quiz> Quizzes { get; set; } = null!;
    public DbSet<Invoice> Invoices { get; set; } = null!;
    public DbSet<QuizQuestion> QuizQuestions { get; set; } = null!;
    public DbSet<Achievement> Achievements { get; set; } = null!;
    public DbSet<ShareableQuiz> ShareableQuizzes { get; set; } = null!;

    public async Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        return await Database.BeginTransactionAsync(cancellationToken);
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new VocabularyEntryConfiguration());
        modelBuilder.ApplyConfiguration(new QuizConfiguration());
        modelBuilder.ApplyConfiguration(new QuizQuestionConfiguration());
        modelBuilder.ApplyConfiguration(new QuizQuestionWithVariantsConfiguration());
        modelBuilder.ApplyConfiguration(new InvoiceConfiguration());
        modelBuilder.ApplyConfiguration(new AchievementConfiguration());
        modelBuilder.ApplyConfiguration(new ShareableQuizConfiguration());
    }
    
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseLazyLoadingProxies();
    }
}
