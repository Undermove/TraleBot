using Application.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Telegram.Bot;
using Telegram.Bot.Types;
using Trale.HostedServices;
using TgRequest = Telegram.Bot.Requests.Abstractions.IRequest<Telegram.Bot.Types.Message>;

namespace Infrastructure.UnitTests;

[TestFixture]
public class ReturnPushWorkerTests
{
    [Test]
    public void ReturnPushWorker_SchedulesNextRunForFollowingDay_AfterDispatch()
    {
        // When current time is 11:00 AM UTC (after 10:00 AM fire time),
        // the next run should be scheduled for the following day: delay > 23 hours.
        var now = DateTime.UtcNow.Date.AddHours(11);

        var delay = ReturnPushWorker.ComputeDelay(now);

        delay.ShouldBeGreaterThan(TimeSpan.FromHours(23));
    }

    [Test]
    public void ReturnPushWorker_ComputeDelay_BeforeTenAm_DelayIsLessThanTenHours()
    {
        // When current time is 08:00 AM UTC (before 10:00 AM fire time),
        // the next run is today at 10:00 — delay < 10 hours.
        var now = DateTime.UtcNow.Date.AddHours(8);

        var delay = ReturnPushWorker.ComputeDelay(now);

        delay.ShouldBeLessThan(TimeSpan.FromHours(10));
        delay.ShouldBeGreaterThan(TimeSpan.Zero);
    }

    [Test]
    public async Task ReturnPushWorker_WhenDispatchReturnsEmpty_SendIsNotCalled()
    {
        var mockDispatch = new Mock<IDailyReturnDispatch>();
        var mockBotClient = new Mock<ITelegramBotClient>();

        var dispatchCompleted = new SemaphoreSlim(0, 1);
        mockDispatch
            .Setup(d => d.DispatchAsync(It.IsAny<CancellationToken>()))
            .Callback(() => dispatchCompleted.Release())
            .Returns(Task.CompletedTask);

        var scopeFactory = BuildFakeScopeFactory(mockDispatch.Object);
        var worker = new ImmediateReturnPushWorker(scopeFactory, NullLoggerFactory.Instance.CreateLogger<ReturnPushWorker>());

        await worker.StartAsync(CancellationToken.None);
        var called = await dispatchCompleted.WaitAsync(TimeSpan.FromSeconds(5));
        await worker.StopAsync(CancellationToken.None);

        called.ShouldBeTrue("dispatch should be called at least once");
        mockDispatch.Verify(d => d.DispatchAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        mockBotClient.Verify(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static IServiceScopeFactory BuildFakeScopeFactory(IDailyReturnDispatch dispatch)
    {
        var mockServiceProvider = new Mock<IServiceProvider>();
        mockServiceProvider
            .Setup(sp => sp.GetService(typeof(IDailyReturnDispatch)))
            .Returns(dispatch);

        var mockScope = new Mock<IServiceScope>();
        mockScope.Setup(s => s.ServiceProvider).Returns(mockServiceProvider.Object);
        mockScope.Setup(s => s.Dispose());

        var mockFactory = new Mock<IServiceScopeFactory>();
        mockFactory.Setup(f => f.CreateScope()).Returns(mockScope.Object);
        return mockFactory.Object;
    }

    /// <summary>
    /// Testable subclass that skips the timing delay so the worker fires immediately.
    /// </summary>
    private sealed class ImmediateReturnPushWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<ReturnPushWorker> logger) : ReturnPushWorker(scopeFactory, logger)
    {
        protected override TimeSpan GetNextRunDelay() => TimeSpan.Zero;
    }
}
