using Application.Common;
using Application.Common.Interfaces;
using Application.Notifications.Holidays;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegrationTests.Notifications;

/// <summary>
/// End-to-end coverage for the holiday push (§82, issue #993). Real Postgres confirms
/// the unique <c>(UserId, "holiday")</c> index collapses concurrent same-day dispatches
/// to a single trigger row — the user can't receive the holiday push twice on the same day.
/// The <see cref="IHolidayCalendarService"/> is stubbed so the test is independent of the
/// real calendar (no need to wait for a real holiday day).
/// </summary>
public class HolidayNotificationServiceTests : TestBase
{
    private const long HolidayTelegramId = 110001L;

    private static readonly Holiday StubTbilisoba = new(
        "tbilisoba",
        "Тбилисоба",
        "თბილისობა",
        "თბილისობა გილოცავ!",
        "Тбилисоба гилоцав!",
        "Поздравляю с Тбилисоба!");

    private sealed class StubHolidayCalendarService : IHolidayCalendarService
    {
        private readonly Holiday? _holiday;
        public StubHolidayCalendarService(Holiday? holiday) => _holiday = holiday;
        public Holiday? GetHolidayFor(DateOnly tbilisiDate) => _holiday;
        public IReadOnlyList<Holiday> AllHolidays() =>
            _holiday is null ? System.Array.Empty<Holiday>() : new[] { _holiday };
    }

    private WebApplicationFactory<Program> WithStubbedHoliday(Holiday? holiday)
    {
        // Reuses the same Postgres container (its DbContext registration), but swaps the
        // calendar so dispatch behaviour is deterministic regardless of the real wall date.
        return _testServer.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IHolidayCalendarService>();
                services.AddSingleton<IHolidayCalendarService>(new StubHolidayCalendarService(holiday));
            });
        });
    }

    [Test]
    public async Task DispatchAsync_HolidayDay_ClaimsTriggerAndDoesNotDoubleSendOnRerun()
    {
        await SeedActiveUserAsync(HolidayTelegramId);

        var server = WithStubbedHoliday(StubTbilisoba);

        await using (var firstRun = server.Services.CreateAsyncScope())
        {
            var dispatcher = firstRun.ServiceProvider.GetRequiredService<IHolidayNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using (var secondRun = server.Services.CreateAsyncScope())
        {
            var dispatcher = secondRun.ServiceProvider.GetRequiredService<IHolidayNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using var verifyScope = server.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == HolidayTelegramId && t.Source == "holiday");

        triggerCount.Should().Be(1,
            because: "the unique (UserId, 'holiday') index must collapse repeated same-day holiday dispatches to a single trigger row");
    }

    [Test]
    public async Task DispatchAsync_NoHolidayToday_DoesNotCreateTrigger()
    {
        // AC6 — обычный день: even with eligible users, no SendMessage and no trigger row.
        await SeedActiveUserAsync(HolidayTelegramId + 1);

        var server = WithStubbedHoliday(holiday: null);

        await using (var run = server.Services.CreateAsyncScope())
        {
            var dispatcher = run.ServiceProvider.GetRequiredService<IHolidayNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using var verifyScope = server.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == HolidayTelegramId + 1 && t.Source == "holiday");
        triggerCount.Should().Be(0,
            because: "non-holiday day must not create any 'holiday' trigger rows");
    }

    [Test]
    public async Task DispatchAsync_NotificationsDisabled_DoesNotCreateTrigger()
    {
        await SeedActiveUserAsync(HolidayTelegramId + 2, notificationsEnabled: false);

        var server = WithStubbedHoliday(StubTbilisoba);

        await using (var run = server.Services.CreateAsyncScope())
        {
            var dispatcher = run.ServiceProvider.GetRequiredService<IHolidayNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }

        await using var verifyScope = server.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == HolidayTelegramId + 2 && t.Source == "holiday");
        triggerCount.Should().Be(0,
            because: "opted-out users must not be claimed by the holiday dispatcher");
    }

    [Test]
    public async Task DispatchAsync_ConcurrentRuns_RecordsExactlyOneTriggerPerUser()
    {
        // Mirrors DailyReturnDoubleSendTests — concurrent app instances dispatching at once.
        await SeedActiveUserAsync(HolidayTelegramId + 3);

        var server = WithStubbedHoliday(StubTbilisoba);

        var concurrentRuns = Enumerable.Range(0, 6).Select(_ => Task.Run(async () =>
        {
            await using var scope = server.Services.CreateAsyncScope();
            var dispatcher = scope.ServiceProvider.GetRequiredService<IHolidayNotificationService>();
            await dispatcher.DispatchAsync(CancellationToken.None);
        }));

        await Task.WhenAll(concurrentRuns);

        await using var verifyScope = server.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var triggerCount = await db.NotificationTriggers
            .CountAsync(t => t.UserId == HolidayTelegramId + 3 && t.Source == "holiday");

        triggerCount.Should().Be(1,
            because: "concurrent dispatch runs must collapse to a single holiday trigger via the unique (UserId, Source) index");
    }

    private async Task SeedActiveUserAsync(long telegramId, bool notificationsEnabled = true)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(telegramId, "HolidayTest");
        user.NotificationsEnabled = notificationsEnabled;
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
    }
}
