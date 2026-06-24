using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Notifications;

/// <summary>
/// End-to-end coverage for the /notifications bot-command (§82, issue #996) — AC4:
/// after the user posts "/notifications off" through the Telegram webhook, the
/// next <see cref="IDailyReturnNotificationService.DispatchAsync"/> run must skip
/// them. The unit tests already pin the command's response text and DB write;
/// here we close the loop by proving the flag is honoured by the dispatcher
/// against a real Postgres.
/// </summary>
public class NotificationsCommandIntegrationTests : TestBase
{
    private const long OptOutTelegramId = 880001L;

    [Test]
    public async Task NotificationsOff_PreventsDailyReturnPushForThatUser()
    {
        await SeedEligibleUserAsync(OptOutTelegramId, notificationsEnabled: true);

        using var client = _testServer.CreateClient();
        var optOut = Create.TelegramUpdate(updateId: 9001, userTelegramId: OptOutTelegramId, text: "/notifications off");
        var response = await client.PostAsync("/telegram/test_token", optOut.ToJsonContent());
        response.EnsureSuccessStatusCode();

        await using (var verifyScope = _testServer.Services.CreateAsyncScope())
        {
            var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
            var user = await db.Users.FirstAsync(u => u.TelegramId == OptOutTelegramId);
            user.NotificationsEnabled.Should().BeFalse(
                because: "/notifications off must flip the flag through the webhook");
        }

        await using (var dispatchScope = _testServer.Services.CreateAsyncScope())
        {
            var dispatcher = dispatchScope.ServiceProvider.GetRequiredService<IDailyReturnNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using var assertScope = _testServer.Services.CreateAsyncScope();
        var ctx = assertScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await ctx.NotificationTriggers
            .CountAsync(t => t.UserId == OptOutTelegramId && t.Source == "daily_return");
        triggerCount.Should().Be(0,
            because: "an opted-out user must not receive the daily-return push");
    }

    private async Task SeedEligibleUserAsync(long telegramId, bool notificationsEnabled)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(telegramId, "OptOutUser");
        user.NotificationsEnabled = notificationsEnabled;
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
