using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Notifications;

/// <summary>
/// End-to-end coverage for the coins-stale push (§82, issue #994): with real Postgres,
/// a single dispatch claims the <c>coins</c> trigger; a second dispatch within the
/// 7-day cooldown is rejected by <c>TryClaimNotificationTriggerAsync</c>, so the user
/// can't be nagged twice in a week.
/// </summary>
public class CoinsNotificationServiceTests : TestBase
{
    private const long CoinsTelegramId = 880001L;

    [Test]
    public async Task DispatchAsync_EligibleUser_ClaimsTriggerAndDoesNotDoubleSendOnRerun()
    {
        await SeedEligibleUserAsync(CoinsTelegramId);

        await using (var firstRun = _testServer.Services.CreateAsyncScope())
        {
            var dispatcher = firstRun.ServiceProvider.GetRequiredService<ICoinsNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using (var secondRun = _testServer.Services.CreateAsyncScope())
        {
            var dispatcher = secondRun.ServiceProvider.GetRequiredService<ICoinsNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using var verifyScope = _testServer.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == CoinsTelegramId && t.Source == "coins");

        triggerCount.Should().Be(1,
            because: "the 7-day cooldown must collapse repeated coins-stale dispatches to a single trigger row");
    }

    [Test]
    public async Task DispatchAsync_NotificationsDisabled_DoesNotCreateTrigger()
    {
        await SeedEligibleUserAsync(CoinsTelegramId + 1, notificationsEnabled: false);

        await using (var run = _testServer.Services.CreateAsyncScope())
        {
            var dispatcher = run.ServiceProvider.GetRequiredService<ICoinsNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using var verifyScope = _testServer.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == CoinsTelegramId + 1 && t.Source == "coins");
        triggerCount.Should().Be(0,
            because: "opted-out users must not be claimed by the coins-stale dispatcher");
    }

    private async Task SeedEligibleUserAsync(long telegramId, bool notificationsEnabled = true)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(telegramId, "CoinsTest");
        user.NotificationsEnabled = notificationsEnabled;
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);

        db.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Xp = 200,
            XpSpent = 0,
            // Never fed Bombora — stale by definition; well past the 7-day cutoff.
            LastFedAtUtc = null,
            Streak = 0,
            Hearts = 0,
            MaxHearts = 0,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-30),
            UpdatedAtUtc = DateTime.UtcNow.AddDays(-1)
        });
        await db.SaveChangesAsync(CancellationToken.None);
    }
}
