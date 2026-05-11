using System.Net;
using Application.Common;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.Models;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Telegram.Bot;

namespace IntegrationTests.BotCommandTests;

public class NotificationsCommandTests : TestBase
{
    private const long TelegramId = 998001;

    [SetUp]
    public async Task SetUpNotifications()
    {
        TelegramClientFake.Reset();
        await SeedUserAsync(TelegramId, notificationsEnabled: true);
    }

    [TearDown]
    public async Task TearDownNotifications()
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

    // ── /notifications off ────────────────────────────────────────────────────

    [Test]
    public async Task NotificationsOff_SetsEnabledFalse_AndRepliesToUser()
    {
        using var client = _testServer.CreateClient();
        var requestBody = Create.TelegramUpdate(updateId: 9980, userTelegramId: TelegramId, text: "/notifications off");

        var response = await client.PostAsync("/telegram/test_token", requestBody.ToJsonContent());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await AssertNotificationsEnabled(TelegramId, expected: false);
        TelegramClientFake.SentMessages.Should().ContainSingle(
            msg => msg.Contains("Уведомления отключены") && msg.Contains("/notifications on"));
    }

    // ── /notifications on ─────────────────────────────────────────────────────

    [Test]
    public async Task NotificationsOn_SetsEnabledTrue_AndRepliesToUser()
    {
        // First disable so we can re-enable
        await SetNotificationsEnabled(TelegramId, false);
        TelegramClientFake.Reset();

        using var client = _testServer.CreateClient();
        var requestBody = Create.TelegramUpdate(updateId: 9981, userTelegramId: TelegramId, text: "/notifications on");

        var response = await client.PostAsync("/telegram/test_token", requestBody.ToJsonContent());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await AssertNotificationsEnabled(TelegramId, expected: true);
        TelegramClientFake.SentMessages.Should().ContainSingle(
            msg => msg.Contains("Уведомления включены") && msg.Contains("/notifications off"));
    }

    // ── DI registration ───────────────────────────────────────────────────────

    [Test]
    public void NotificationsCommand_IsRegisteredInRouter()
    {
        using var scope = _testServer.Services.CreateScope();
        var commands = scope.ServiceProvider.GetServices<IBotCommand>();
        commands.Should().ContainSingle(c => c is NotificationsCommand);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == telegramId);
        user.Should().NotBeNull();
        user!.NotificationsEnabled.Should().Be(expected);
    }
}
