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
    public DbSet<ProcessedUpdate> ProcessedUpdates { get; set; } = null!;
    public DbSet<GeorgianQuizSession> GeorgianQuizSessions { get; set; } = null!;
    public DbSet<MiniAppUserProgress> MiniAppUserProgresses { get; set; } = null!;
    public DbSet<Payment> Payments { get; set; } = null!;
    public DbSet<Referral> Referrals { get; set; } = null!;
    public DbSet<NotificationTrigger> NotificationTriggers { get; set; } = null!;

    public async Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        return await Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task<bool> TryClaimNotificationTriggerAsync(
        long userId, string source, string? variant, DateTime now, DateTime cutoff, CancellationToken cancellationToken)
    {
        if (Database.IsNpgsql())
        {
            // Single-statement atomic claim. The unique (UserId, Source) index turns the
            // second concurrent caller into an ON CONFLICT: it refreshes the row only when the
            // previous send is older than the cooldown cutoff, otherwise it touches nothing.
            // Affected-row count is 1 exactly when THIS caller inserted or refreshed the slot,
            // and 0 when a fresh trigger already exists — so concurrent runs can't both "win".
            var affected = await Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "NotificationTriggers" ("Id", "UserId", "Source", "LastSentAt", "Variant")
                VALUES ({Guid.NewGuid()}, {userId}, {source}, {now}, {variant})
                ON CONFLICT ("UserId", "Source") DO UPDATE
                    SET "LastSentAt" = EXCLUDED."LastSentAt", "Variant" = EXCLUDED."Variant"
                    WHERE "NotificationTriggers"."LastSentAt" <= {cutoff}
                """, cancellationToken);
            return affected > 0;
        }

        // Non-relational providers (EF in-memory unit tests) can't run the raw upsert and don't
        // enforce the unique index. Emulate the claim with tracked entities; these tests are
        // single-threaded, so atomicity isn't needed — only the same win/lose decision.
        var existing = await NotificationTriggers
            .FirstOrDefaultAsync(t => t.UserId == userId && t.Source == source, cancellationToken);
        if (existing is null)
        {
            NotificationTriggers.Add(new NotificationTrigger
            {
                Id = Guid.NewGuid(), UserId = userId, Source = source, LastSentAt = now, Variant = variant
            });
            await SaveChangesAsync(cancellationToken);
            return true;
        }
        if (existing.LastSentAt <= cutoff)
        {
            existing.LastSentAt = now;
            existing.Variant = variant;
            await SaveChangesAsync(cancellationToken);
            return true;
        }
        return false;
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
        modelBuilder.ApplyConfiguration(new ProcessedUpdateConfiguration());
        modelBuilder.ApplyConfiguration(new GeorgianQuizSessionConfiguration());
        modelBuilder.ApplyConfiguration(new MiniAppUserProgressConfiguration());
        modelBuilder.ApplyConfiguration(new PaymentConfiguration());
        modelBuilder.ApplyConfiguration(new ReferralConfiguration());
        modelBuilder.ApplyConfiguration(new NotificationTriggerConfiguration());
    }
    
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseLazyLoadingProxies();
    }
}
