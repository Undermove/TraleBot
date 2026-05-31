using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Admin;
using Application.Common;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Monitoring;
using IntegrationTests.Fakes;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Persistence;
using Telegram.Bot;
using Testcontainers.PostgreSql;

namespace IntegrationTests.Admin;

/// <summary>
/// Integration tests for WinBackBroadcastService and POST /api/admin/winback.
/// Tests run in declared order because each builds on shared DB state.
/// </summary>
[TestFixture]
public class WinBackBroadcastIntegrationTests
{
    private PostgreSqlContainer _postgresqlContainer = null!;
    private TraleTestApplication _app = null!;
    private WinBackAuthTestApplication _authApp = null!;

    private const string TestBotToken = "test_winback_bot_token_xyz";
    private const long TestOwnerTelegramId = 309149393;
    private const string InitDataHeader = "X-Telegram-Init-Data";

    // Cohort window matching WinBackBroadcastService hardcoded parameters
    private static readonly DateTime CohortDay = new(2026, 5, 13, 12, 0, 0, DateTimeKind.Utc);

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        _postgresqlContainer = new PostgreSqlBuilder()
            .WithCleanUp(true)
            .WithImage("postgres:16.1")
            .Build();

        await _postgresqlContainer.StartAsync();
        var cs = _postgresqlContainer.GetConnectionString();

        _app = new TraleTestApplication(cs);
        _authApp = new WinBackAuthTestApplication(cs, TestBotToken, TestOwnerTelegramId);

        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TraleDbContext>();
        await db.Database.MigrateAsync();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _app.DisposeAsync();
        await _authApp.DisposeAsync();
        await _postgresqlContainer.StopAsync();
        await _postgresqlContainer.DisposeAsync();
    }

    // ─── helpers ────────────────────────────────────────────────────────────────

    private async Task<User> SeedUserAsync(
        TraleTestApplication app,
        DateTime registeredAt,
        DateTime? lastActivityAt = null)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var userId = Guid.NewGuid();
        var settingsId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            TelegramId = Random.Shared.NextInt64(1_000_000, 9_999_999),
            AccountType = UserAccountType.Free,
            InitialLanguageSet = true,
            IsActive = true,
            RegisteredAtUtc = registeredAt,
            UserSettingsId = settingsId,
            Settings = new UserSettings { Id = settingsId, UserId = userId, CurrentLanguage = Language.Georgian }
        };

        await db.Users.AddAsync(user);

        if (lastActivityAt.HasValue)
        {
            var progress = new MiniAppUserProgress
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                LastPlayedAtUtc = lastActivityAt,
                Xp = 0, Streak = 0, Hearts = 0, MaxHearts = 0,
                CompletedLessonsJson = "{}",
                CreatedAtUtc = lastActivityAt.Value,
                UpdatedAtUtc = lastActivityAt.Value
            };
            await db.MiniAppUserProgresses.AddAsync(progress);
        }

        await db.SaveChangesAsync(CancellationToken.None);
        return user;
    }

    private WinBackBroadcastService ResolveService(TraleTestApplication app, IServiceScope scope)
    {
        return scope.ServiceProvider.GetRequiredService<WinBackBroadcastService>();
    }

    private static string GenerateInitData(string botToken, long userId)
    {
        var authDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var userJson = $"{{\"id\":{userId},\"first_name\":\"TestOwner\"}}";
        var dataCheckString = $"auth_date={authDate}\nuser={userJson}";

        using var secretKeyHmac = new HMACSHA256(Encoding.UTF8.GetBytes("WebAppData"));
        var secretKey = secretKeyHmac.ComputeHash(Encoding.UTF8.GetBytes(botToken));
        using var dataHmac = new HMACSHA256(secretKey);
        var hash = Convert.ToHexString(dataHmac.ComputeHash(Encoding.UTF8.GetBytes(dataCheckString))).ToLowerInvariant();

        return $"auth_date={authDate}&user={Uri.EscapeDataString(userJson)}&hash={hash}";
    }

    // ─── service tests ───────────────────────────────────────────────────────────

    [Test, Order(1)]
    public async Task ExecuteAsync_DryRun_ReturnsCorrectCountsWithoutSideEffects()
    {
        var eligibleUser = await SeedUserAsync(_app, CohortDay);

        using var scope = _app.Services.CreateScope();
        var service = ResolveService(_app, scope);

        var result = await service.ExecuteAsync(dryRun: true, CancellationToken.None);

        result.Sent.Should().BeGreaterThan(0, "dry-run should report eligible candidate count");

        // Verify no side-effects
        using var verifyScope = _app.Services.CreateScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = await db.Users.FindAsync(eligibleUser.Id);
        user!.WinBackSentAtUtc.Should().BeNull("dry-run must not set WinBackSentAtUtc");
    }

    [Test, Order(2)]
    public async Task ExecuteAsync_SecondRun_ReturnsSentZero()
    {
        // Seed one more eligible user for this test
        await SeedUserAsync(_app, CohortDay);

        using var scope1 = _app.Services.CreateScope();
        var service1 = ResolveService(_app, scope1);
        await service1.ExecuteAsync(dryRun: false, CancellationToken.None);

        using var scope2 = _app.Services.CreateScope();
        var service2 = ResolveService(_app, scope2);
        var result = await service2.ExecuteAsync(dryRun: false, CancellationToken.None);

        result.Sent.Should().Be(0, "dedup should prevent sending twice to same users");
    }

    [Test, Order(3)]
    public async Task ExecuteAsync_ActiveUser_NotIncludedInSent()
    {
        // All previous cohort users are now marked (from Order 2).
        // Seed a user who was active yesterday — should be excluded by the inactivity filter.
        var activeUser = await SeedUserAsync(_app, CohortDay, lastActivityAt: DateTime.UtcNow.AddDays(-1));

        using var scope = _app.Services.CreateScope();
        var service = ResolveService(_app, scope);
        await service.ExecuteAsync(dryRun: false, CancellationToken.None);

        using var verifyScope = _app.Services.CreateScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = await db.Users.FindAsync(activeUser.Id);
        user!.WinBackSentAtUtc.Should().BeNull("active user must not receive win-back");
    }

    [Test, Order(4)]
    public async Task ExecuteAsync_DryRun_EmptyCohort_ReturnsAllZeros()
    {
        // All cohort users are now either marked or active — no eligible candidates.
        using var scope = _app.Services.CreateScope();
        var service = ResolveService(_app, scope);
        var result = await service.ExecuteAsync(dryRun: true, CancellationToken.None);

        result.Sent.Should().Be(0);
        result.Skipped.Should().Be(0);
        result.Failed.Should().Be(0);
    }

    // ─── HTTP tests ──────────────────────────────────────────────────────────────

    [Test, Order(5)]
    public async Task POST_AdminWinback_WithoutAuth_Returns404()
    {
        using var client = _app.CreateClient();

        var response = await client.PostAsync("/api/admin/winback?dryRun=true", null);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Test, Order(6)]
    public async Task POST_AdminWinback_Returns200WithCorrectJson()
    {
        // Seed the owner user so IsOwnerAsync DB-check passes
        using var seedScope = _authApp.Services.CreateScope();
        var db = seedScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var ownerExists = await db.Users.AnyAsync(u => u.TelegramId == TestOwnerTelegramId);
        if (!ownerExists)
        {
            var ownerId = Guid.NewGuid();
            var settingsId = Guid.NewGuid();
            await db.Users.AddAsync(new User
            {
                Id = ownerId,
                TelegramId = TestOwnerTelegramId,
                AccountType = UserAccountType.Free,
                InitialLanguageSet = true,
                IsActive = true,
                RegisteredAtUtc = DateTime.UtcNow.AddDays(-60),
                UserSettingsId = settingsId,
                Settings = new UserSettings { Id = settingsId, UserId = ownerId, CurrentLanguage = Language.Georgian }
            });
            await db.SaveChangesAsync(CancellationToken.None);
        }

        using var client = _authApp.CreateClient();
        var initData = GenerateInitData(TestBotToken, TestOwnerTelegramId);
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/admin/winback?dryRun=true");
        request.Headers.Add(InitDataHeader, initData);

        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        root.TryGetProperty("sent", out var sentProp).Should().BeTrue("response must contain 'sent'");
        root.TryGetProperty("skipped", out var skippedProp).Should().BeTrue("response must contain 'skipped'");
        root.TryGetProperty("failed", out var failedProp).Should().BeTrue("response must contain 'failed'");
        (sentProp.GetInt32() + skippedProp.GetInt32() + failedProp.GetInt32()).Should().BeGreaterThanOrEqualTo(0);
    }

    // ─── custom WebApplicationFactory with real auth token ─────────────────────

    private class WinBackAuthTestApplication : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _botToken;
        private readonly long _ownerTelegramId;

        public WinBackAuthTestApplication(string connectionString, string botToken, long ownerTelegramId)
        {
            _connectionString = connectionString;
            _botToken = botToken;
            _ownerTelegramId = ownerTelegramId;
        }

        protected override IHost CreateHost(IHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<TraleDbContext>));
                if (descriptor != null) services.Remove(descriptor);
                services.AddDbContext<ITraleDbContext, TraleDbContext>(options => options.UseNpgsql(_connectionString));

                services.RemoveAll(typeof(ITelegramBotClient));
                services.AddSingleton<ITelegramBotClient, TelegramClientFake>();

                services.RemoveAll(typeof(Infrastructure.Telegram.BotConfiguration));
                services.AddSingleton(new Infrastructure.Telegram.BotConfiguration
                {
                    Token = _botToken,
                    HostAddress = "https://example.com",
                    WebhookToken = "test_token",
                    PaymentProviderToken = "test_payment_token",
                    BotName = "traletestmock_bot",
                    OwnerTelegramId = _ownerTelegramId
                });

                services.RemoveAll<IPrometheusResolver>();
                services.AddSingleton<IPrometheusResolver, PrometheusResolverFake>();
            });
            return base.CreateHost(builder);
        }
    }
}
