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
    public DbSet<Verb> Verbs { get; set; } = null!;
    public DbSet<VerbForm> VerbForms { get; set; } = null!;
    public DbSet<VerbProvenance> VerbProvenances { get; set; } = null!;
    public DbSet<ModelBudgetDay> ModelBudgetDays { get; set; } = null!;
    public DbSet<VerbFormProgress> VerbFormProgresses { get; set; } = null!;
    public DbSet<UserVerb> UserVerbs { get; set; } = null!;
    public DbSet<VerbSession> VerbSessions { get; set; } = null!;
    public DbSet<VerbSectionVisit> VerbSectionVisits { get; set; } = null!;
    public DbSet<TranslationCacheEntry> TranslationCache { get; set; } = null!;
    public DbSet<BroadcastCampaign> BroadcastCampaigns { get; set; } = null!;
    public DbSet<BroadcastDelivery> BroadcastDeliveries { get; set; } = null!;
    public DbSet<QueuedTranslation> QueuedTranslations { get; set; } = null!;
    public DbSet<UserFeedback> UserFeedback { get; set; } = null!;
    public DbSet<FeedbackReply> FeedbackReplies { get; set; } = null!;

    public async Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        return await Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task LockUserFeedbackAsync(Guid userId, CancellationToken cancellationToken)
    {
        // Non-relational providers (EF in-memory unit tests): single-threaded, nothing to hold.
        if (!Database.IsNpgsql()) return;
        await Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({"user-feedback:" + userId}, 0))", cancellationToken);
    }

    public async Task MarkSurveyStepAsync(Guid deliveryId, bool finished, DateTime atUtc, CancellationToken cancellationToken)
    {
        if (Database.IsNpgsql())
        {
            if (finished)
            {
                await Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE "BroadcastDeliveries" SET "SurveyFinishedAtUtc" = {atUtc}
                    WHERE "Id" = {deliveryId} AND "SurveyFinishedAtUtc" IS NULL
                    """, cancellationToken);
            }
            else
            {
                await Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE "BroadcastDeliveries" SET "SurveyOpenedAtUtc" = {atUtc}
                    WHERE "Id" = {deliveryId} AND "SurveyOpenedAtUtc" IS NULL
                    """, cancellationToken);
            }
            return;
        }

        // Non-relational providers (EF in-memory unit tests): single-threaded, no atomicity needed.
        var delivery = await BroadcastDeliveries.FirstOrDefaultAsync(d => d.Id == deliveryId, cancellationToken);
        if (delivery == null) return;
        if (finished) delivery.SurveyFinishedAtUtc ??= atUtc;
        else delivery.SurveyOpenedAtUtc ??= atUtc;
        await SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> TryClaimBroadcastDeliveryAsync(Guid deliveryId, CancellationToken cancellationToken)
    {
        if (Database.IsNpgsql())
        {
            var affected = await Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE "BroadcastDeliveries" SET "Status" = {(int)BroadcastDeliveryStatus.Sending}
                WHERE "Id" = {deliveryId} AND "Status" = {(int)BroadcastDeliveryStatus.Pending}
                """, cancellationToken);
            return affected == 1;
        }

        // Non-relational providers (EF in-memory unit tests): single-threaded, no atomicity needed.
        var delivery = await BroadcastDeliveries.FirstOrDefaultAsync(d => d.Id == deliveryId, cancellationToken);
        if (delivery is not { Status: BroadcastDeliveryStatus.Pending }) return false;
        delivery.Status = BroadcastDeliveryStatus.Sending;
        await SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> TryClaimCampaignGiftAsync(
        Guid deliveryId, DateTime grantedAtUtc, DateTime accessUntilUtc, CancellationToken cancellationToken)
    {
        if (Database.IsNpgsql())
        {
            var affected = await Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE "BroadcastDeliveries"
                SET "GiftGrantedAtUtc" = {grantedAtUtc}, "GiftAccessUntilUtc" = {accessUntilUtc}
                WHERE "Id" = {deliveryId} AND "GiftGrantedAtUtc" IS NULL
                """, cancellationToken);
            return affected == 1;
        }

        // Non-relational providers (EF in-memory unit tests): single-threaded, no atomicity needed.
        var delivery = await BroadcastDeliveries.FirstOrDefaultAsync(d => d.Id == deliveryId, cancellationToken);
        if (delivery is not { GiftGrantedAtUtc: null }) return false;
        delivery.GiftGrantedAtUtc = grantedAtUtc;
        delivery.GiftAccessUntilUtc = accessUntilUtc;
        await SaveChangesAsync(cancellationToken);
        return true;
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
        modelBuilder.ApplyConfiguration(new VerbConfiguration());
        modelBuilder.ApplyConfiguration(new VerbFormConfiguration());
        modelBuilder.ApplyConfiguration(new VerbProvenanceConfiguration());
        modelBuilder.ApplyConfiguration(new ModelBudgetDayConfiguration());
        modelBuilder.ApplyConfiguration(new VerbFormProgressConfiguration());
        modelBuilder.ApplyConfiguration(new UserVerbConfiguration());
        modelBuilder.ApplyConfiguration(new VerbSessionConfiguration());
        modelBuilder.ApplyConfiguration(new VerbSectionVisitConfiguration());
        modelBuilder.ApplyConfiguration(new TranslationCacheEntryConfiguration());
        modelBuilder.ApplyConfiguration(new QueuedTranslationConfiguration());
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
        modelBuilder.ApplyConfiguration(new BroadcastCampaignConfiguration());
        modelBuilder.ApplyConfiguration(new BroadcastDeliveryConfiguration());
        modelBuilder.ApplyConfiguration(new UserFeedbackConfiguration());
        modelBuilder.ApplyConfiguration(new FeedbackReplyConfiguration());
    }
    
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseLazyLoadingProxies();
    }
}
