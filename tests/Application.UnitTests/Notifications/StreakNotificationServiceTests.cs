using Application.Common.Interfaces;
using Application.Notifications;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Notifications;

public class StreakNotificationServiceTests : CommandTestsBase
{
    private Mock<IUserNotificationService> _notificationServiceMock = null!;
    private StreakNotificationService _sut = null!;
    private const long TestTelegramId = 88001L;

    [SetUp]
    public void SetUp()
    {
        _notificationServiceMock = new Mock<IUserNotificationService>();
        _notificationServiceMock
            .Setup(s => s.SendStreakMilestonePushAsync(
                It.IsAny<User>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _sut = new StreakNotificationService(
            Context,
            _notificationServiceMock.Object,
            NullLoggerFactory.Instance);
    }

    private async Task<User> SeedUserWithStreak(int streak, bool notificationsEnabled = true, bool isActive = true)
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
            Streak = streak,
            LastPlayedAtUtc = DateTime.UtcNow,
            Xp = 0, XpSpent = 0, Hearts = 0, MaxHearts = 0,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-streak),
            UpdatedAtUtc = DateTime.UtcNow
        });
        await Context.SaveChangesAsync();
        return user;
    }

    private void VerifyPushSent(int milestone, Times times) =>
        _notificationServiceMock.Verify(
            s => s.SendStreakMilestonePushAsync(
                It.Is<User>(u => u.TelegramId == TestTelegramId),
                milestone,
                It.IsAny<CancellationToken>()),
            times);

    [Test]
    public async Task DispatchAsync_StreakOf7_SendsMilestonePushAndRecordsTrigger()
    {
        await SeedUserWithStreak(7);

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(7, Times.Once());
        var trigger = Context.NotificationTriggers
            .FirstOrDefault(t => t.UserId == TestTelegramId && t.Source == "streak_7");
        trigger.ShouldNotBeNull();
        trigger.LastSentAt.ShouldBeGreaterThan(DateTime.UtcNow.AddMinutes(-1));
    }

    [Test]
    public async Task DispatchAsync_StreakOf30_SendsMilestonePushWithStreak30()
    {
        await SeedUserWithStreak(30);

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(30, Times.Once());
        Context.NotificationTriggers
            .Any(t => t.UserId == TestTelegramId && t.Source == "streak_30")
            .ShouldBeTrue();
    }

    [Test]
    public async Task DispatchAsync_StreakOf100_SendsMilestonePushWithStreak100()
    {
        await SeedUserWithStreak(100);

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(100, Times.Once());
        Context.NotificationTriggers
            .Any(t => t.UserId == TestTelegramId && t.Source == "streak_100")
            .ShouldBeTrue();
    }

    [Test]
    public async Task DispatchAsync_NonMilestoneStreak_DoesNotSend()
    {
        await SeedUserWithStreak(15);

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendStreakMilestonePushAsync(
                It.IsAny<User>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_OptedOutUser_DoesNotSend()
    {
        await SeedUserWithStreak(7, notificationsEnabled: false);

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendStreakMilestonePushAsync(
                It.IsAny<User>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_InactiveUser_DoesNotSend()
    {
        await SeedUserWithStreak(7, isActive: false);

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendStreakMilestonePushAsync(
                It.IsAny<User>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_SameMilestoneTwiceInOneDay_SendsOnlyOnce()
    {
        await SeedUserWithStreak(7);

        await _sut.DispatchAsync(CancellationToken.None);
        var firstSentAt = Context.NotificationTriggers
            .First(t => t.UserId == TestTelegramId && t.Source == "streak_7").LastSentAt;

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(7, Times.Once());
        var afterSecond = Context.NotificationTriggers
            .First(t => t.UserId == TestTelegramId && t.Source == "streak_7").LastSentAt;
        afterSecond.ShouldBe(firstSentAt);
    }

    [Test]
    public async Task DispatchAsync_DifferentMilestonesForSameUser_SendsEach()
    {
        // Hitting 30 weeks after 7 should still fire — distinct Source per milestone.
        var user = await SeedUserWithStreak(7);
        await _sut.DispatchAsync(CancellationToken.None);

        var progress = Context.MiniAppUserProgresses.First(p => p.UserId == user.Id);
        progress.Streak = 30;
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(7, Times.Once());
        VerifyPushSent(30, Times.Once());
    }
}
