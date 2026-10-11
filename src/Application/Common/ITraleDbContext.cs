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
    DbSet<Verb> Verbs { get; }
    DbSet<VerbForm> VerbForms { get; }
    DbSet<VerbProvenance> VerbProvenances { get; }
    DbSet<ModelBudgetDay> ModelBudgetDays { get; }
    DbSet<VerbFormProgress> VerbFormProgresses { get; }
    DbSet<UserVerb> UserVerbs { get; }
    DbSet<VerbSession> VerbSessions { get; }
    DbSet<VerbSectionVisit> VerbSectionVisits { get; }
    DbSet<TranslationCacheEntry> TranslationCache { get; }
    DbSet<BroadcastCampaign> BroadcastCampaigns { get; }
    DbSet<BroadcastDelivery> BroadcastDeliveries { get; }
    DbSet<QueuedTranslation> QueuedTranslations { get; }
    DbSet<UserFeedback> UserFeedback { get; }
    DbSet<FeedbackReply> FeedbackReplies { get; }

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

    /// <summary>
    /// Atomically moves a broadcast delivery from Pending to Sending. Returns <c>true</c> only for
    /// the one caller that made the move — whoever gets <c>false</c> must not send. This is what
    /// keeps a double click or two overlapping requests from sending the same message twice.
    /// </summary>
    Task<bool> TryClaimBroadcastDeliveryAsync(Guid deliveryId, CancellationToken cancellationToken);

    /// <summary>
    /// Atomically marks a campaign's gift as given to this recipient. Returns <c>true</c> only for
    /// the one caller that made the mark — only that caller may change the user's access. This is
    /// what keeps repeated opens, two replicas or two parallel requests from giving the gift twice.
    /// </summary>
    Task<bool> TryClaimCampaignGiftAsync(
        Guid deliveryId, DateTime grantedAtUtc, DateTime accessUntilUtc, CancellationToken cancellationToken);

    /// <summary>
    /// Makes writes of one person's feedback go one at a time: the call waits until every other
    /// transaction holding the same person's lock has ended, and holds it until the current
    /// transaction ends. Must be called inside a transaction, before reading the rows the decision
    /// rests on — this is what keeps two replicas or two parallel requests from both deciding
    /// "not asked yet" or "still under the limit".
    /// </summary>
    Task LockUserFeedbackAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// Records, once, that a survey's recipient opened its form in the mini-app (or, with
    /// <paramref name="finished"/>, reached its last page). Later calls change nothing — the first
    /// time stays, whatever is repeated or raced.
    /// </summary>
    Task MarkSurveyStepAsync(Guid deliveryId, bool finished, DateTime atUtc, CancellationToken cancellationToken);
}
