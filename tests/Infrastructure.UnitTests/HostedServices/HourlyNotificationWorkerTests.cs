using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common.Interfaces;
using Application.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Trale.HostedServices;

namespace Infrastructure.UnitTests.HostedServices;

/// <summary>
/// Covers AC for #997 (HourlyNotificationWorker):
/// - ComputeDelayUntilNextHour wakes the worker at top-of-hour.
/// - RunOnceAsync invokes Holiday / Coins / Streak dispatchers exactly once each.
/// - A throwing dispatcher does NOT block the next two (fault-isolation).
/// - Program.cs registers the worker as a hosted service.
/// </summary>
[TestFixture]
public class HourlyNotificationWorkerTests
{
    private static HourlyNotificationWorker BuildWorker(IServiceScopeFactory scopeFactory)
        => new(scopeFactory, NullLogger<HourlyNotificationWorker>.Instance);

    [Test]
    public void ComputeDelayUntilNextHour_AtTopOfHour_ReturnsFullHour()
    {
        // 09:00:00 UTC → next top-of-hour is 10:00 → 1h.
        var now = new DateTime(2026, 6, 24, 9, 0, 0, DateTimeKind.Utc);

        var delay = HourlyNotificationWorker.ComputeDelayUntilNextHour(now);

        delay.ShouldBe(TimeSpan.FromHours(1));
    }

    [Test]
    public void ComputeDelayUntilNextHour_PartwayThroughHour_ReturnsRemainder()
    {
        // 09:35:00 UTC → 25m until 10:00.
        var now = new DateTime(2026, 6, 24, 9, 35, 0, DateTimeKind.Utc);

        var delay = HourlyNotificationWorker.ComputeDelayUntilNextHour(now);

        delay.ShouldBe(TimeSpan.FromMinutes(25));
    }

    [Test]
    public void ComputeDelayUntilNextHour_HalfSecondPastTopOfHour_DoesNotReturnZero()
    {
        // 09:00:00.500 UTC → ~59m 59.5s. Guard: if we returned 0 or a negative the worker
        // would tight-loop a million times before the next hour.
        var now = new DateTime(2026, 6, 24, 9, 0, 0, 500, DateTimeKind.Utc);

        var delay = HourlyNotificationWorker.ComputeDelayUntilNextHour(now);

        delay.ShouldBeGreaterThan(TimeSpan.FromMinutes(59));
        delay.ShouldBeLessThan(TimeSpan.FromHours(1));
        delay.ShouldBe(TimeSpan.FromHours(1) - TimeSpan.FromMilliseconds(500));
    }

    [Test]
    public void ComputeDelayUntilNextHour_AtEndOfDay_RollsToMidnightOfNextDay()
    {
        // 23:30:00 UTC on 06-24 → 30m until 00:00 UTC on 06-25.
        var now = new DateTime(2026, 6, 24, 23, 30, 0, DateTimeKind.Utc);

        var delay = HourlyNotificationWorker.ComputeDelayUntilNextHour(now);

        delay.ShouldBe(TimeSpan.FromMinutes(30));
    }

    [Test]
    public async Task RunOnceAsync_InvokesAllThreeDispatchersOnce()
    {
        var holiday = new Mock<IHolidayNotificationService>(MockBehavior.Strict);
        var coins = new Mock<ICoinsNotificationService>(MockBehavior.Strict);
        var streak = new Mock<IStreakNotificationService>(MockBehavior.Strict);
        holiday.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        coins.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        streak.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var sp = BuildProvider(holiday.Object, coins.Object, streak.Object);
        var worker = BuildWorker(sp.GetRequiredService<IServiceScopeFactory>());

        await worker.RunOnceAsync(CancellationToken.None);

        holiday.Verify(s => s.DispatchAsync(It.IsAny<CancellationToken>()), Times.Once);
        coins.Verify(s => s.DispatchAsync(It.IsAny<CancellationToken>()), Times.Once);
        streak.Verify(s => s.DispatchAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task RunOnceAsync_WhenHolidayThrows_StillInvokesCoinsAndStreak()
    {
        // Fault-isolation AC: a holiday-side bug must not silence the other two contexts.
        var holiday = new Mock<IHolidayNotificationService>();
        holiday
            .Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("calendar blip"));
        var coins = new Mock<ICoinsNotificationService>();
        var streak = new Mock<IStreakNotificationService>();
        coins.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        streak.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var sp = BuildProvider(holiday.Object, coins.Object, streak.Object);
        var worker = BuildWorker(sp.GetRequiredService<IServiceScopeFactory>());

        await Should.NotThrowAsync(() => worker.RunOnceAsync(CancellationToken.None));
        coins.Verify(s => s.DispatchAsync(It.IsAny<CancellationToken>()), Times.Once);
        streak.Verify(s => s.DispatchAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task RunOnceAsync_WhenCoinsThrows_StreakStillRuns()
    {
        // Mid-pipeline failure: streak must still get its turn.
        var holiday = new Mock<IHolidayNotificationService>();
        var coins = new Mock<ICoinsNotificationService>();
        var streak = new Mock<IStreakNotificationService>();
        holiday.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        coins.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>()))
             .ThrowsAsync(new InvalidOperationException("redis blip"));
        streak.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var sp = BuildProvider(holiday.Object, coins.Object, streak.Object);
        var worker = BuildWorker(sp.GetRequiredService<IServiceScopeFactory>());

        await Should.NotThrowAsync(() => worker.RunOnceAsync(CancellationToken.None));
        streak.Verify(s => s.DispatchAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task RunOnceAsync_PropagatesHostShutdownCancellation()
    {
        // If the cancellation comes from the host (graceful shutdown), the worker should NOT
        // pretend it ran a successful iteration. We bubble the OperationCanceledException up
        // so the ExecuteAsync loop can break cleanly.
        var holiday = new Mock<IHolidayNotificationService>();
        var coins = new Mock<ICoinsNotificationService>();
        var streak = new Mock<IStreakNotificationService>();
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        holiday.Setup(s => s.DispatchAsync(It.IsAny<CancellationToken>()))
               .ThrowsAsync(new OperationCanceledException(cts.Token));

        var sp = BuildProvider(holiday.Object, coins.Object, streak.Object);
        var worker = BuildWorker(sp.GetRequiredService<IServiceScopeFactory>());

        await Should.ThrowAsync<OperationCanceledException>(() => worker.RunOnceAsync(cts.Token));
    }

    [Test]
    public void Program_RegistersHourlyNotificationWorkerAsHostedService()
    {
        // Wiring guarantee — keeps CI honest if someone deletes the AddHostedService line.
        var programSource = System.IO.File.ReadAllText(FindProgramCsPath());
        programSource.ShouldContain("AddHostedService<HourlyNotificationWorker>");
    }

    [TestCase(5)]  // 09:00 Tbilisi
    public void TbilisiMorningWindow_IsHolidayPushHour_True_AtNineAmTbilisi(int utcHour)
    {
        // 05:xx UTC == 09:xx Tbilisi (UTC+4) — the only window the holiday push should fire.
        var utc = new DateTime(2026, 4, 11, utcHour, 30, 0, DateTimeKind.Utc);
        TbilisiMorningWindow.IsHolidayPushHour(utc).ShouldBeTrue();
    }

    [TestCase(0)]   // 04:00 Tbilisi
    [TestCase(4)]   // 08:00 Tbilisi
    [TestCase(6)]   // 10:00 Tbilisi
    [TestCase(23)]  // 03:00 Tbilisi next day
    public void TbilisiMorningWindow_IsHolidayPushHour_False_OutsideMorningWindow(int utcHour)
    {
        var utc = new DateTime(2026, 4, 11, utcHour, 15, 0, DateTimeKind.Utc);
        TbilisiMorningWindow.IsHolidayPushHour(utc).ShouldBeFalse();
    }

    [Test]
    public void TbilisiMorningWindow_IsHolidayPushHour_False_At03TbilisiOfHolidayDay()
    {
        // AC: 04-11 03:xx Tbilisi (= 23:xx UTC on 04-10) → not the morning window.
        // Independence Day starts in Georgia, but a 3am push would be a usability disaster.
        var utc = new DateTime(2026, 4, 10, 23, 15, 0, DateTimeKind.Utc);
        TbilisiMorningWindow.IsHolidayPushHour(utc).ShouldBeFalse();
    }

    private static ServiceProvider BuildProvider(
        IHolidayNotificationService holiday,
        ICoinsNotificationService coins,
        IStreakNotificationService streak)
    {
        var services = new ServiceCollection();
        services.AddSingleton(holiday);
        services.AddSingleton(coins);
        services.AddSingleton(streak);
        return services.BuildServiceProvider();
    }

    private static string FindProgramCsPath()
    {
        var dir = AppContext.BaseDirectory;
        for (var i = 0; i < 10 && dir is not null; i++)
        {
            var candidate = System.IO.Path.Combine(dir, "src", "Trale", "Program.cs");
            if (System.IO.File.Exists(candidate)) return candidate;
            dir = System.IO.Path.GetDirectoryName(dir);
        }
        throw new System.IO.FileNotFoundException("Could not locate src/Trale/Program.cs");
    }
}
