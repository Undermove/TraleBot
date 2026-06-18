using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage;

namespace Application.Common;

public interface ITraleDbContext
{
    DbSet<User> Users { get; }
    DbSet<UserSettings> UsersSettings { get; }
    DbSet<VocabularyEntry> VocabularyEntries { get; }
    DbSet<Quiz> Quizzes { get; }
    DbSet<Invoice> Invoices { get; }
    DbSet<QuizQuestion> QuizQuestions { get; }
    DbSet<Achievement> Achievements { get; }
    DbSet<ShareableQuiz> ShareableQuizzes { get; }
    DbSet<ProcessedUpdate> ProcessedUpdates { get; }
    DbSet<GeorgianQuizSession> GeorgianQuizSessions { get; }
    DbSet<MiniAppUserProgress> MiniAppUserProgresses { get; }
    DbSet<Payment> Payments { get; }
    DbSet<Referral> Referrals { get; }
    DbSet<NotificationTrigger> NotificationTriggers { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
    EntityEntry Entry(object entity);

    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically claims the notification slot for (<paramref name="userId"/>, <paramref name="source"/>):
    /// inserts the trigger, or refreshes it only if the previous send is older than
    /// <paramref name="cutoff"/> (cooldown elapsed). Returns <c>true</c> if THIS caller won the
    /// claim and should therefore send the push; <c>false</c> if a fresh trigger already exists
    /// (another concurrent run holds it). Backed by a unique (UserId, Source) index so overlapping
    /// dispatch runs collapse to a single send — see the 2026-06-17 double-send incident.
    /// </summary>
    Task<bool> TryClaimNotificationTriggerAsync(
        long userId, string source, string? variant, DateTime now, DateTime cutoff, CancellationToken cancellationToken);
}