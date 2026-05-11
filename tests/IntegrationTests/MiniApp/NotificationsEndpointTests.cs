using System.Net;
using System.Net.Http.Json;
using System.Text;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Integration tests for PATCH /api/miniapp/notifications endpoint.
/// Covers issue #899 — Profile «Уведомления» section with master toggle.
/// </summary>
public class NotificationsEndpointTests : TestBase
{
    private const long TelegramId = 998099L;
    private const string BotToken = "test_bot_token";

    [SetUp]
    public async Task SetUp()
    {
        await SeedUserAsync(TelegramId, notificationsEnabled: true);
    }

    [TearDown]
    public async Task TearDown()
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TraleDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == TelegramId);
        if (user != null)
        {
            db.Users.Remove(user);
            await db.SaveChangesAsync();
        }
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    [Test]
    public async Task PatchNotifications_WithValidPayload_Returns200AndPersistsFlag()
    {
        using var client = CreateAuthenticatedClient(TelegramId);

        var response = await client.PatchAsync(
            "/api/miniapp/notifications",
            JsonContent.Create(new { enabled = false }));

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "valid PATCH with enabled=false should succeed");

        await AssertNotificationsEnabled(TelegramId, expected: false);
    }

    [Test]
    public async Task PatchNotifications_EnableTrue_Returns200AndPersistsFlag()
    {
        await SetNotificationsEnabled(TelegramId, false);
        using var client = CreateAuthenticatedClient(TelegramId);

        var response = await client.PatchAsync(
            "/api/miniapp/notifications",
            JsonContent.Create(new { enabled = true }));

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "valid PATCH with enabled=true should succeed");

        await AssertNotificationsEnabled(TelegramId, expected: true);
    }

    // ── Negative cases ────────────────────────────────────────────────────────

    [Test]
    public async Task PatchNotifications_WithMissingEnabled_Returns400()
    {
        using var client = CreateAuthenticatedClient(TelegramId);

        var response = await client.PatchAsync(
            "/api/miniapp/notifications",
            new StringContent("{}", Encoding.UTF8, "application/json"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest,
            because: "missing 'enabled' field must be rejected with 400");
    }

    [Test]
    public async Task PatchNotifications_Unauthenticated_Returns401()
    {
        using var client = _testServer.CreateClient();

        var response = await client.PatchAsync(
            "/api/miniapp/notifications",
            JsonContent.Create(new { enabled = false }));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
            because: "unauthenticated request must be rejected with 401");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private HttpClient CreateAuthenticatedClient(long telegramId)
    {
        var client = _testServer.CreateClient();
        var initData = MiniAppInitDataHelper.CreateValidInitData(telegramId, BotToken);
        client.DefaultRequestHeaders.Add("X-Telegram-Init-Data", initData);
        return client;
    }

    private async Task SeedUserAsync(long telegramId, bool notificationsEnabled)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TraleDbContext>();

        var existing = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == telegramId);
        if (existing != null) return;

        var userId = Guid.NewGuid();
        var settingsId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = userId,
            TelegramId = telegramId,
            AccountType = UserAccountType.Free,
            RegisteredAtUtc = DateTime.UtcNow,
            InitialLanguageSet = true,
            IsActive = true,
            NotificationsEnabled = notificationsEnabled,
            UserSettingsId = settingsId,
            Settings = new UserSettings
            {
                Id = settingsId,
                UserId = userId,
                CurrentLanguage = Language.Russian
            }
        });
        await db.SaveChangesAsync();
    }

    private async Task SetNotificationsEnabled(long telegramId, bool enabled)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TraleDbContext>();
        var user = await db.Users.FirstAsync(u => u.TelegramId == telegramId);
        user.NotificationsEnabled = enabled;
        await db.SaveChangesAsync();
    }

    private async Task AssertNotificationsEnabled(long telegramId, bool expected)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TraleDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == telegramId);
        user.Should().NotBeNull();
        user!.NotificationsEnabled.Should().Be(expected);
    }
}
