using Application.Translation;
using Hangfire;
using Hangfire.PostgreSql;
using Hangfire.PostgreSql.Factories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;

namespace Infrastructure.BackgroundJobs;

/// <summary>
/// The durable job queue: Hangfire, with its tables in the application's own Postgres database
/// (schema <c>hangfire</c>, created by Hangfire itself on first start). A job queued by one instance is
/// picked up by a worker of any instance; one whose worker died is delivered again.
/// </summary>
public static class JobQueueSetup
{
    public const string Schema = "hangfire";

    /// <summary>
    /// How long a job whose worker stopped giving signs of life stays hidden before another worker may
    /// take it. With the sliding timeout a live worker renews it every fifth of this (12 s), so it can
    /// be short however long the job runs; Hangfire's default — a fixed 30 minutes from the fetch —
    /// would leave a translation unanswered that long after its instance died.
    /// </summary>
    public static readonly TimeSpan InvisibilityTimeout = TimeSpan.FromMinutes(1);

    /// <summary>
    /// The instance is small, and a translation job mostly waits (for a model, or for another instance
    /// to finish), so a few workers are enough; more jobs than workers simply wait their turn.
    /// </summary>
    public const int Workers = 4;

    public static IServiceCollection AddJobQueue(this IServiceCollection services)
    {
        // The storage is this container's own object (not Hangfire's static JobStorage.Current), on
        // the same connection string as the application's DbContext — whatever configured that.
        services.AddSingleton<JobStorage>(provider =>
        {
            using var scope = provider.CreateScope();
            var connectionString = scope.ServiceProvider.GetRequiredService<TraleDbContext>().Database.GetConnectionString()
                                   ?? throw new InvalidOperationException("The job queue needs the database connection string");
            var options = new PostgreSqlStorageOptions
            {
                SchemaName = Schema,
                PrepareSchemaIfNecessary = true,
                InvisibilityTimeout = InvisibilityTimeout,
                UseSlidingInvisibilityTimeout = true,
                // A worker of the instance that queued a job is woken at once; this is how soon the
                // other instances notice a job (one queued elsewhere, or given back by a dead worker).
                QueuePollInterval = TimeSpan.FromSeconds(15),
                // A database that is not there yet must not keep the application from starting: two
                // quick retries, then the queue comes up by itself when the database does.
                StartupConnectionMaxRetries = 2,
                AllowDegradedModeWithoutStorage = true
            };
            return new PostgreSqlStorage(new NpgsqlConnectionFactory(connectionString, options), options);
        });

        services.AddHangfire((provider, configuration) => configuration
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseLogProvider(new HostLogProvider(provider.GetRequiredService<Microsoft.Extensions.Logging.ILoggerFactory>())));
        services.AddHangfireServer(options => options.WorkerCount = Workers);

        services.AddSingleton<ITranslationJobQueue, TranslationJobQueue>();
        services.AddSingleton<JobQueueMonitor>();
        return services;
    }
}

/// <summary><see cref="ITranslationJobQueue"/> on Hangfire.</summary>
public class TranslationJobQueue(IBackgroundJobClient client) : ITranslationJobQueue
{
    public void Enqueue(Guid queuedTranslationId) =>
        client.Enqueue<TranslationQueueJob>(job => job.RunAsync(queuedTranslationId, CancellationToken.None));
}

/// <summary>The background job behind a translation that outlived its request: <see cref="TranslationJobs.ResumeAsync"/>.</summary>
public class TranslationQueueJob(TranslationJobs jobs)
{
    /// <summary>
    /// How often a translation is started is decided by <see cref="TranslationJobs"/> itself
    /// (<c>TranslationAgent:JobMaxAttempts</c>); what is retried here is only the job failing around it —
    /// the database being away. After that the job stays in the queue's failed list.
    /// </summary>
    /// <param name="stop">Hangfire's: cancelled when the worker stops; the job then goes back to the queue.</param>
    [AutomaticRetry(Attempts = 5, OnAttemptsExceeded = AttemptsExceededAction.Fail)]
    public Task RunAsync(Guid queuedTranslationId, CancellationToken stop) => jobs.ResumeAsync(queuedTranslationId, stop);
}

/// <summary>What is in the job queue right now, for the owner (<c>GET /api/admin/jobs</c>).</summary>
public class JobQueueMonitor(JobStorage storage)
{
    public record Counts(long Enqueued, long Scheduled, long Processing, long Succeeded, long Failed, long Servers);

    public Counts Read()
    {
        var statistics = storage.GetMonitoringApi().GetStatistics();
        return new Counts(
            statistics.Enqueued, statistics.Scheduled, statistics.Processing, statistics.Succeeded, statistics.Failed, statistics.Servers);
    }
}
