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
                It.IsAny<User>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _sut = new DailyReturnNotificationService(
            Context,
            _notificationServiceMock.Object,
            NullLoggerFactory.Instance);
    }

    private async Task<User> SeedEligibleUser(string completedLessonsJson = """{"alphabet-progressive":[1,2,3]}""")
    {
        var user = Create.User().Build();
        user.TelegramId = TestTelegramId;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            LastPlayedAtUtc = DateTime.UtcNow.AddDays(-2),
            CompletedLessonsJson = completedLessonsJson,
            Xp = 0, Streak = 0, Hearts = 0, MaxHearts = 0,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-2),
            UpdatedAtUtc = DateTime.UtcNow.AddDays(-2)
        });
        await Context.SaveChangesAsync();
        return user;
    }

    [Test]
    public async Task DispatchAsync_EligibleUser_SendsPushAndRecordsTrigger()
    {
        await SeedEligibleUser();

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.Is<User>(u => u.TelegramId == TestTelegramId),
                "alphabet-progressive",
                4,
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);

        var trigger = Context.NotificationTriggers
            .FirstOrDefault(t => t.UserId == TestTelegramId && t.Source == "daily_return");
        trigger.ShouldNotBeNull();
        trigger.LastSentAt.ShouldBeGreaterThan(DateTime.UtcNow.AddMinutes(-1));
    }

    [Test]
    public async Task DispatchAsync_SameDayCooldown_SkipsUser()
    {
        await SeedEligibleUser();
        Context.NotificationTriggers.Add(new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = TestTelegramId,
            Source = "daily_return",
            LastSentAt = DateTime.UtcNow.Date
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_EmptyCompletedLessons_SkipsUser()
    {
        await SeedEligibleUser(completedLessonsJson: "{}");

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_WithinSevenDayCooldown_SkipsWithLog()
    {
        await SeedEligibleUser();
        Context.NotificationTriggers.Add(new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = TestTelegramId,
            Source = "daily_return",
            LastSentAt = DateTime.UtcNow.AddDays(-5)
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_OutsideSevenDayCooldown_SendsNotification()
    {
        await SeedEligibleUser();
        Context.NotificationTriggers.Add(new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = TestTelegramId,
            Source = "daily_return",
            LastSentAt = DateTime.UtcNow.AddDays(-8)
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.Is<User>(u => u.TelegramId == TestTelegramId),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task DispatchAsync_NotificationsDisabled_SkipsUser()
    {
        var user = Create.User().Build();
        user.TelegramId = TestTelegramId;
        user.NotificationsEnabled = false;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            LastPlayedAtUtc = DateTime.UtcNow.AddDays(-2),
            CompletedLessonsJson = """{"alphabet-progressive":[1,2,3]}""",
            Xp = 0, Streak = 0, Hearts = 0, MaxHearts = 0,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-2),
            UpdatedAtUtc = DateTime.UtcNow.AddDays(-2)
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_PassesVariantToNotificationService()
    {
        await SeedEligibleUser();

        string? capturedVariant = null;
        _notificationServiceMock
            .Setup(s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<User, string, int, string, CancellationToken>(
                (_, _, _, variant, _) => capturedVariant = variant)
            .Returns(Task.CompletedTask);

        await _sut.DispatchAsync(CancellationToken.None);

        capturedVariant.ShouldNotBeNull();
        capturedVariant.ShouldBeOneOf("A", "B");
    }

    [Test]
    public async Task DispatchAsync_ResolvesNextLessonIdCorrectly()
    {
        await SeedEligibleUser(completedLessonsJson: """{"alphabet-progressive":[1,2,3]}""");

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.Is<User>(u => u.TelegramId == TestTelegramId),
                "alphabet-progressive",
                4,
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task DispatchAsync_NullCompletedLessons_SkipsUser()
    {
        await SeedEligibleUser(completedLessonsJson: "null");

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendDailyReturnPushAsync(
                It.IsAny<User>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_UnknownModuleId_DoesNotThrow()
    {
        await SeedEligibleUser(completedLessonsJson: """{"some-deleted-module":[1,2]}""");

        await Should.NotThrowAsync(() => _sut.DispatchAsync(CancellationToken.None));
    }
}
