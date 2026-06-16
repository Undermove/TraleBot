using Application.Common.Interfaces;
using Application.Notifications;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Notifications;

public class DailyReturnNotificationServiceTests : CommandTestsBase
{
    private Mock<IUserNotificationService> _notificationServiceMock = null!;
    private DailyReturnNotificationService _sut = null!;
    private const long TestTelegramId = 99001L;

    [SetUp]
    public void SetUp()
    {
        _notificationServiceMock = new Mock<IUserNotificationService>();
        _notificationServiceMock
            .Setup(s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _sut = new DailyReturnNotificationService(
            Context,
            _notificationServiceMock.Object,
            NullLoggerFactory.Instance);
    }

    private async Task<User> SeedEligibleUser(
        string completedLessonsJson = """{"alphabet-progressive":[1,2,3]}""",
        bool notificationsEnabled = true)
    {
        var user = Create.User().Build();
        user.TelegramId = TestTelegramId;
        user.NotificationsEnabled = notificationsEnabled;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            LastPlayedAtUtc = DateTime.UtcNow.AddDays(-2),
            CompletedLessonsJson = completedLessonsJson,
            Xp = 0, XpSpent = 0, Streak = 0, Hearts = 0, MaxHearts = 0,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-2),
            UpdatedAtUtc = DateTime.UtcNow.AddDays(-2)
        });
        await Context.SaveChangesAsync();
        return user;
    }

    private void VerifyPushSent(Times times) =>
        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            times);

    [Test]
    public async Task DispatchAsync_EligibleUser_SendsPushAndRecordsTrigger()
    {
        await SeedEligibleUser();

        await _sut.DispatchAsync(CancellationToken.None);

        // moduleName falls back to moduleId; lessonId = max(completed) + 1.
        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.Is<User>(u => u.TelegramId == TestTelegramId),
                "alphabet-progressive", "alphabet-progressive", 4,
                It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Once);

        var trigger = Context.NotificationTriggers
            .FirstOrDefault(t => t.UserId == TestTelegramId && t.Source == "daily_return");
        trigger.ShouldNotBeNull();
        trigger.LastSentAt.ShouldBeGreaterThan(DateTime.UtcNow.AddMinutes(-1));
    }

    [Test]
    public async Task DispatchAsync_EmptyCompletedLessons_SkipsUser()
    {
        await SeedEligibleUser(completedLessonsJson: "{}");
        await _sut.DispatchAsync(CancellationToken.None);
        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_NullCompletedLessons_SkipsUser()
    {
        await SeedEligibleUser(completedLessonsJson: "null");
        await _sut.DispatchAsync(CancellationToken.None);
        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_WithinSevenDayCooldown_SkipsUser()
    {
        await SeedEligibleUser();
        Context.NotificationTriggers.Add(new NotificationTrigger
        {
            Id = Guid.NewGuid(), UserId = TestTelegramId, Source = "daily_return",
            LastSentAt = DateTime.UtcNow.AddDays(-5)
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);
        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_OutsideSevenDayCooldown_SendsNotification()
    {
        await SeedEligibleUser();
        Context.NotificationTriggers.Add(new NotificationTrigger
        {
            Id = Guid.NewGuid(), UserId = TestTelegramId, Source = "daily_return",
            LastSentAt = DateTime.UtcNow.AddDays(-8)
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);
        VerifyPushSent(Times.Once());
    }

    [Test]
    public async Task DispatchAsync_NotificationsDisabled_SkipsUser()
    {
        await SeedEligibleUser(notificationsEnabled: false);
        await _sut.DispatchAsync(CancellationToken.None);
        VerifyPushSent(Times.Never());
    }

    [Test]
    public async Task DispatchAsync_NoXp_PicksEarnVariant()
    {
        await SeedEligibleUser(); // Xp = 0 → not enough to feed → "earn"

        string? capturedVariant = null;
        _notificationServiceMock
            .Setup(s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Callback<User, string, string, int, string, int, CancellationToken>(
                (_, _, _, _, variant, _, _) => capturedVariant = variant)
            .Returns(Task.CompletedTask);

        await _sut.DispatchAsync(CancellationToken.None);

        capturedVariant.ShouldBe("earn");
    }
}
