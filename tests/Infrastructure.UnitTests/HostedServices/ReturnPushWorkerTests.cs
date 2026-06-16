using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Telegram.Bot;
using Trale.HostedServices;
using TgRequest = Telegram.Bot.Requests.Abstractions.IRequest<Telegram.Bot.Types.Message>;

namespace Infrastructure.UnitTests.HostedServices;

/// <summary>
/// Covers AC from QA test plan on #952:
/// - Worker schedules next run for the following day after a dispatch.
/// - Worker resolves IDailyReturnNotificationService from scope and calls DispatchAsync once.
/// - When the dispatcher does nothing (no eligible users) the worker doesn't reach the Telegram client.
/// </summary>
[TestFixture]
public class ReturnPushWorkerTests
{
    private static ReturnPushWorker BuildWorker(IServiceScopeFactory scopeFactory)
        => new(scopeFactory, NullLogger<ReturnPushWorker>.Instance);

    [Test]
    public void ComputeDelayUntilNextRun_WhenNowBefore10Utc_ReturnsDelayUntilToday10Utc()
    {
        var now = new DateTime(2026, 6, 15, 8, 30, 0, DateTimeKind.Utc);

        var delay = ReturnPushWorker.ComputeDelayUntilNextRun(now);

        delay.ShouldBe(TimeSpan.FromHours(1) + TimeSpan.FromMinutes(30));
    }

    [Test]
    public void ComputeDelayUntilNextRun_WhenNowAfter10Utc_ReturnsDelayUntilTomorrow10Utc()
    {
        var now = new DateTime(2026, 6, 15, 11, 0, 0, DateTimeKind.Utc);

        var delay = ReturnPushWorker.ComputeDelayUntilNextRun(now);

        // From 11:00 today to 10:00 next day = 23h
        delay.ShouldBe(TimeSpan.FromHours(23));
    }

    [Test]
    public void ComputeDelayUntilNextRun_WhenNowExactlyAt10Utc_SchedulesForTomorrow10Utc()
    {
        // Mirrors AC "ReturnPushWorker_SchedulesNextRunForFollowingDay_AfterDispatch":
        // a fresh dispatch at 10:00 must push the next slot 24h out.
        var now = new DateTime(2026, 6, 15, 10, 0, 0, DateTimeKind.Utc);

        var delay = ReturnPushWorker.ComputeDelayUntilNextRun(now);

        delay.ShouldBe(TimeSpan.FromHours(24));
        delay.ShouldBeGreaterThan(TimeSpan.FromHours(23));
    }

    [Test]
    public async Task RunOnceAsync_ResolvesDispatcherFromScope_AndCallsDispatchAsync()
    {
        var dispatcher = new Mock<IDailyReturnNotificationService>(MockBehavior.Strict);
        dispatcher
            .Setup(d => d.DispatchAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var services = new ServiceCollection();
        services.AddSingleton(dispatcher.Object);
        var sp = services.BuildServiceProvider();
        var worker = BuildWorker(sp.GetRequiredService<IServiceScopeFactory>());

        await worker.RunOnceAsync(CancellationToken.None);

        dispatcher.Verify(d => d.DispatchAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task RunOnceAsync_WhenDispatchReturnsEmpty_SendIsNotCalled()
    {
        // If the dispatcher decides nobody is eligible (no-op), the worker must NOT side-step
        // into the Telegram client itself. Worker is a pure scheduler.
        var dispatcher = new Mock<IDailyReturnNotificationService>();
        dispatcher
            .Setup(d => d.DispatchAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var botClient = new Mock<ITelegramBotClient>(MockBehavior.Strict);

        var services = new ServiceCollection();
        services.AddSingleton(dispatcher.Object);
        services.AddSingleton(botClient.Object);
        var sp = services.BuildServiceProvider();
        var worker = BuildWorker(sp.GetRequiredService<IServiceScopeFactory>());

        await worker.RunOnceAsync(CancellationToken.None);

        botClient.Verify(
            c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task RunOnceAsync_WhenDispatchThrows_LogsAndSwallows()
    {
        // The worker is a daemon — a transient dispatch failure must not crash the host.
        var dispatcher = new Mock<IDailyReturnNotificationService>();
        dispatcher
            .Setup(d => d.DispatchAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("DB blip"));
        var services = new ServiceCollection();
        services.AddSingleton(dispatcher.Object);
        var sp = services.BuildServiceProvider();
        var worker = BuildWorker(sp.GetRequiredService<IServiceScopeFactory>());

        await Should.NotThrowAsync(() => worker.RunOnceAsync(CancellationToken.None));
    }

    [Test]
    public void Program_RegistersReturnPushWorkerAsHostedService()
    {
        // Static guarantee that wiring is in place. Grep keeps CI honest if someone removes it.
        var programSource = System.IO.File.ReadAllText(
            FindProgramCsPath());
        programSource.ShouldContain("AddHostedService<ReturnPushWorker>");
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
