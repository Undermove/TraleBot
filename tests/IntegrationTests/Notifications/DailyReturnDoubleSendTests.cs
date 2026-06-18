using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Notifications;

/// <summary>
/// Regression for the prod incident (2026-06-17): 129 users received the daily-return
/// push twice because two dispatch runs overlapped (replica/rolling-deploy), each loaded
/// the cooldown state once and neither saw the other's writes. The fix claims the
/// NotificationTrigger slot atomically (unique index + INSERT … ON CONFLICT) BEFORE
/// sending, so concurrent runs collapse to a single push per (user, source).
/// </summary>
public class DailyReturnDoubleSendTests : TestBase
{
    private const long EligibleTelegramId = 770001L;

    [Test]
    public async Task DispatchAsync_RunConcurrently_RecordsExactlyOneTriggerPerUser()
    {
        await SeedEligibleUserAsync(EligibleTelegramId);

        // Fire several dispatch cycles at once, each in its own DI scope (its own
        // DbContext) — this reproduces two app instances dispatching in parallel.
        var concurrentRuns = Enumerable.Range(0, 6).Select(_ => Task.Run(async () =>
        {
            await using var scope = _testServer.Services.CreateAsyncScope();
            var dispatcher = scope.ServiceProvider.GetRequiredService<IDailyReturnNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }));

        await Task.WhenAll(concurrentRuns);

        await using var verifyScope = _testServer.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == EligibleTelegramId && t.Source == "daily_return");

        triggerCount.Should().Be(1,
            because: "concurrent dispatch runs must collapse to a single daily-return trigger (and thus a single push)");
    }

    private async Task SeedEligibleUserAsync(long telegramId)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(telegramId, "ReturnTest");
        user.NotificationsEnabled = true;
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);

        db.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            LastPlayedAtUtc = DateTime.UtcNow.AddDays(-2),
            CompletedLessonsJson = """{"alphabet-progressive":[1,2,3]}""",
            Xp = 0,
            XpSpent = 0,
            Streak = 0,
            Hearts = 0,
            MaxHearts = 0,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-2),
            UpdatedAtUtc = DateTime.UtcNow.AddDays(-2)
        });
        await db.SaveChangesAsync(CancellationToken.None);
    }
}
