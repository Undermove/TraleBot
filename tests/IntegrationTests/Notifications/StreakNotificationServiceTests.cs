using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Notifications;

/// <summary>
/// End-to-end coverage for the streak-milestone push (§82, issue #995): with a real
/// Postgres, a single dispatch claims a <c>streak_{milestone}</c> trigger; a second
/// dispatch in the same day is rejected by the unique <c>(UserId, Source)</c> index,
/// so the user can't receive the same milestone push twice.
/// </summary>
public class StreakNotificationServiceTests : TestBase
{
    private const long StreakTelegramId = 990001L;

    [Test]
    public async Task DispatchAsync_StreakOf7_ClaimsTriggerAndDoesNotDoubleSendOnRerun()
    {
        await SeedUserWithStreakAsync(StreakTelegramId, streak: 7);

        await using (var firstRun = _testServer.Services.CreateAsyncScope())
        {
            var dispatcher = firstRun.ServiceProvider.GetRequiredService<IStreakNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using (var secondRun = _testServer.Services.CreateAsyncScope())
        {
            var dispatcher = secondRun.ServiceProvider.GetRequiredService<IStreakNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using var verifyScope = _testServer.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == StreakTelegramId && t.Source == "streak_7");

        triggerCount.Should().Be(1,
            because: "the unique (UserId, Source) index must collapse repeated streak_7 dispatches to a single trigger row");
    }

    [Test]
    public async Task DispatchAsync_NotificationsDisabled_DoesNotCreateTrigger()
    {
        await SeedUserWithStreakAsync(StreakTelegramId + 1, streak: 30, notificationsEnabled: false);

        await using (var run = _testServer.Services.CreateAsyncScope())
        {
            var dispatcher = run.ServiceProvider.GetRequiredService<IStreakNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using var verifyScope = _testServer.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == StreakTelegramId + 1 && t.Source.StartsWith("streak_"));
        triggerCount.Should().Be(0,
            because: "opted-out users must not be claimed by the streak dispatcher");
    }

    private async Task SeedUserWithStreakAsync(long telegramId, int streak, bool notificationsEnabled = true)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(telegramId, "StreakTest");
        user.NotificationsEnabled = notificationsEnabled;
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);

        db.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Streak = streak,
            LastPlayedAtUtc = DateTime.UtcNow,
            Xp = 0,
            XpSpent = 0,
            Hearts = 0,
            MaxHearts = 0,
            CompletedLessonsJson = """{"alphabet-progressive":[1,2,3]}""",
            CreatedAtUtc = DateTime.UtcNow.AddDays(-streak),
            UpdatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync(CancellationToken.None);
    }
}
