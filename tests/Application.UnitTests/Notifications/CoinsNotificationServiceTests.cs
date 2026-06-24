using Application.Common.Interfaces;
using Application.Notifications;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Notifications;

public class CoinsNotificationServiceTests : CommandTestsBase
{
    private Mock<IUserNotificationService> _notificationServiceMock = null!;
    private CoinsNotificationService _sut = null!;
    private const long TestTelegramId = 77001L;

    [SetUp]
    public void SetUp()
    {
        _notificationServiceMock = new Mock<IUserNotificationService>();
        _notificationServiceMock
            .Setup(s => s.SendCoinsStalePushAsync(
                It.IsAny<User>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _sut = new CoinsNotificationService(
            Context,
            _notificationServiceMock.Object,
            NullLoggerFactory.Instance);
    }

    private async Task<User> SeedUser(
        int xp,
        int xpSpent,
        DateTime? lastFedAtUtc,
        bool notificationsEnabled = true,
        bool isActive = true)
    {
        var user = Create.User().Build();
        user.TelegramId = TestTelegramId;
        user.NotificationsEnabled = notificationsEnabled;
        user.IsActive = isActive;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Xp = xp,
            XpSpent = xpSpent,
            LastFedAtUtc = lastFedAtUtc,
            Streak = 0, Hearts = 0, MaxHearts = 0,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-30),
            UpdatedAtUtc = DateTime.UtcNow
        });
        await Context.SaveChangesAsync();
        return user;
    }

    private void VerifyPushSent(Times times, int? expectedXp = null) =>
        _notificationServiceMock.Verify(
            s => s.SendCoinsStalePushAsync(
                It.Is<User>(u => u.TelegramId == TestTelegramId),
                expectedXp.HasValue ? It.Is<int>(x => x == expectedXp.Value) : It.IsAny<int>(),
                It.IsAny<CancellationToken>()),
            times);

    [Test]
    public async Task DispatchAsync_BalanceAtThresholdAndStaleFeeding_SendsPushAndRecordsTrigger()
    {
        // 50 XP available, last fed 10 days ago — exactly the §82 happy path.
        await SeedUser(xp: 50, xpSpent: 0, lastFedAtUtc: DateTime.UtcNow.AddDays(-10));

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Once(), expectedXp: 50);
        var trigger = Context.NotificationTriggers
            .FirstOrDefault(t => t.UserId == TestTelegramId && t.Source == "coins");
        trigger.ShouldNotBeNull();
        trigger.LastSentAt.ShouldBeGreaterThan(DateTime.UtcNow.AddMinutes(-1));
    }

    [Test]
    public async Task DispatchAsync_NeverFed_TreatsAsStaleAndSends()
    {
        // LastFedAtUtc null → user has never fed Bombora; still eligible if balance ≥ 50.
        await SeedUser(xp: 80, xpSpent: 0, lastFedAtUtc: null);

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Once(), expectedXp: 80);
    }

    [Test]
    public async Task DispatchAsync_BalanceBelowThreshold_DoesNotSend()
    {
        await SeedUser(xp: 49, xpSpent: 0, lastFedAtUtc: DateTime.UtcNow.AddDays(-10));

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_SpentEqualsXp_NothingToFeed_DoesNotSend()
    {
        // Earned a lot but already spent it all — balance < 50.
        await SeedUser(xp: 500, xpSpent: 480, lastFedAtUtc: DateTime.UtcNow.AddDays(-10));

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_RecentlyFed_DoesNotSend()
    {
        // Fed 3 days ago → still considered "actively feeding", don't nag.
        await SeedUser(xp: 200, xpSpent: 0, lastFedAtUtc: DateTime.UtcNow.AddDays(-3));

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_OptedOutUser_DoesNotSend()
    {
        await SeedUser(xp: 100, xpSpent: 0, lastFedAtUtc: null, notificationsEnabled: false);

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_InactiveUser_DoesNotSend()
    {
        await SeedUser(xp: 100, xpSpent: 0, lastFedAtUtc: null, isActive: false);

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_WithinSevenDayCooldown_DoesNotSendAndDoesNotChangeLastSent()
    {
        // AC2 — baseline 7d without spend, balance 50+, but last "coins" push 6d ago.
        // Expectation: 0 new sends; LastSentAt of the existing trigger doesn't change.
        await SeedUser(xp: 80, xpSpent: 0, lastFedAtUtc: DateTime.UtcNow.AddDays(-10));
        var existingSentAt = DateTime.UtcNow.AddDays(-6);
        Context.NotificationTriggers.Add(new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = TestTelegramId,
            Source = "coins",
            LastSentAt = existingSentAt
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Never());
        var trigger = Context.NotificationTriggers
            .First(t => t.UserId == TestTelegramId && t.Source == "coins");
        // Tolerance for DB round-trip precision on DateTime.
        Math.Abs((trigger.LastSentAt - existingSentAt).TotalSeconds).ShouldBeLessThan(1);
    }

    [Test]
    public async Task DispatchAsync_OutsideSevenDayCooldown_Sends()
    {
        await SeedUser(xp: 80, xpSpent: 0, lastFedAtUtc: DateTime.UtcNow.AddDays(-10));
        Context.NotificationTriggers.Add(new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = TestTelegramId,
            Source = "coins",
            LastSentAt = DateTime.UtcNow.AddDays(-8)
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Once());
    }

    [Test]
    public async Task DispatchAsync_NoProgressRow_DoesNotSend()
    {
        // User without a MiniAppUserProgress shouldn't even be considered.
        var user = Create.User().Build();
        user.TelegramId = TestTelegramId;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Times.Never());
    }
}
