using Application.Admin;
using Application.Common;
using Application.Notifications;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Notifications;

public class NotificationDispatcherIntegrationTests : TestBase
{
    [Test]
    public async Task Dispatcher_EndToEnd_HolidayMatch_SendsTelegramMessageAndPersistsLastSentAt()
    {
        using var scope = _testServer.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(901_000L, "NotifUser");
        user.NotificationsEnabled = true;
        await db.Users.AddAsync(user);
        await db.SaveChangesAsync(CancellationToken.None);

        var fakeSender = new FakeSender();
        var holidayCalendar = scope.ServiceProvider.GetRequiredService<HolidayCalendarService>();
        // Jan 7 in Tbilisi = Jan 6 20:00 UTC (UTC+4)
        var fakeTime = new FixedTimeProvider(new DateTimeOffset(2026, 1, 6, 20, 0, 0, TimeSpan.Zero));

        var dispatcher = new NotificationDispatcherService(db, holidayCalendar, fakeSender, fakeTime);
        await dispatcher.ExecuteAsync(CancellationToken.None);

        fakeSender.CallCount.Should().Be(1);

        var trigger = await db.NotificationTriggers
            .FirstOrDefaultAsync(t => t.UserId == user.Id && t.Source == NotificationSource.Holiday);
        trigger.Should().NotBeNull();
        trigger!.LastSentAt.Should().NotBeNull();
    }

    [Test]
    public async Task Dispatcher_RunTwiceSameDay_SendsOnlyOnce()
    {
        using var scope = _testServer.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(901_001L, "NotifUser2");
        user.NotificationsEnabled = true;
        await db.Users.AddAsync(user);
        await db.SaveChangesAsync(CancellationToken.None);

        var fakeSender = new FakeSender();
        var holidayCalendar = scope.ServiceProvider.GetRequiredService<HolidayCalendarService>();
        var fakeTime = new FixedTimeProvider(new DateTimeOffset(2026, 1, 6, 20, 0, 0, TimeSpan.Zero));

        var dispatcher = new NotificationDispatcherService(db, holidayCalendar, fakeSender, fakeTime);

        // First run — should send
        await dispatcher.ExecuteAsync(CancellationToken.None);
        fakeSender.CallCount.Should().Be(1);

        // Second run on the same Tbilisi day — should NOT send again
        await dispatcher.ExecuteAsync(CancellationToken.None);
        fakeSender.CallCount.Should().Be(1, "dispatcher must not re-send on same day");
    }

    private sealed class FakeSender : ITelegramMessageSender
    {
        public int CallCount { get; private set; }

        public Task<bool> SendTextAsync(long telegramId, string text, bool includeMiniAppButton, CancellationToken ct)
        {
            CallCount++;
            return Task.FromResult(true);
        }
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
