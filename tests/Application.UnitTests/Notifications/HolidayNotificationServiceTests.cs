using Application.Common.Interfaces;
using Application.Notifications;
using Application.Notifications.Holidays;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Notifications;

public class HolidayNotificationServiceTests : CommandTestsBase
{
    private Mock<IUserNotificationService> _notificationServiceMock = null!;
    private Mock<IHolidayCalendarService> _calendarMock = null!;
    private HolidayNotificationService _sut = null!;
    private const long TestTelegramId = 99001L;

    private static readonly Holiday Tbilisoba = new(
        "tbilisoba",
        "Тбилисоба",
        "თბილისობა",
        "თბილისობა გილოცავ!",
        "Тбилисоба гилоцав!",
        "Поздравляю с Тбилисоба!");

    private static readonly Holiday Easter = new(
        "easter",
        "Пасха",
        "აღდგომა",
        "ქრისტე აღდგა!",
        "Кристэ агдга!",
        "Христос Воскресе!");

    [SetUp]
    public void SetUp()
    {
        _notificationServiceMock = new Mock<IUserNotificationService>();
        _notificationServiceMock
            .Setup(s => s.SendHolidayPushAsync(
                It.IsAny<User>(), It.IsAny<Holiday>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _calendarMock = new Mock<IHolidayCalendarService>();

        _sut = new HolidayNotificationService(
            Context,
            _notificationServiceMock.Object,
            _calendarMock.Object,
            NullLoggerFactory.Instance);
    }

    private async Task<User> SeedUser(bool notificationsEnabled = true, bool isActive = true)
    {
        var user = Create.User().Build();
        user.TelegramId = TestTelegramId;
        user.NotificationsEnabled = notificationsEnabled;
        user.IsActive = isActive;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        return user;
    }

    private void StubHoliday(Holiday? holiday) =>
        _calendarMock.Setup(c => c.GetHolidayFor(It.IsAny<DateOnly>())).Returns(holiday);

    private void VerifyPushSent(Holiday holiday, Times times) =>
        _notificationServiceMock.Verify(
            s => s.SendHolidayPushAsync(
                It.Is<User>(u => u.TelegramId == TestTelegramId),
                It.Is<Holiday>(h => h.Key == holiday.Key),
                It.IsAny<CancellationToken>()),
            times);

    [Test]
    public async Task DispatchAsync_HolidayToday_SendsPushAndRecordsTrigger()
    {
        // AC1 — opted-in active user, holiday day → 1 send + a 'holiday' trigger row.
        await SeedUser();
        StubHoliday(Tbilisoba);

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Tbilisoba, Times.Once());
        var trigger = Context.NotificationTriggers
            .FirstOrDefault(t => t.UserId == TestTelegramId && t.Source == "holiday");
        trigger.ShouldNotBeNull();
        trigger.LastSentAt.ShouldBeGreaterThan(DateTime.UtcNow.AddMinutes(-1));
        trigger.Variant.ShouldBe("tbilisoba");
    }

    [Test]
    public async Task DispatchAsync_NoHolidayToday_DoesNotQueryUsersOrSend()
    {
        // AC6 — обычный день: even with an eligible user, nothing fires.
        await SeedUser();
        StubHoliday(null);

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendHolidayPushAsync(
                It.IsAny<User>(), It.IsAny<Holiday>(), It.IsAny<CancellationToken>()),
            Times.Never);
        Context.NotificationTriggers.Any(t => t.Source == "holiday").ShouldBeFalse();
    }

    [Test]
    public async Task DispatchAsync_OptedOutUser_DoesNotSend()
    {
        await SeedUser(notificationsEnabled: false);
        StubHoliday(Tbilisoba);

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendHolidayPushAsync(
                It.IsAny<User>(), It.IsAny<Holiday>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_InactiveUser_DoesNotSend()
    {
        await SeedUser(isActive: false);
        StubHoliday(Tbilisoba);

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendHolidayPushAsync(
                It.IsAny<User>(), It.IsAny<Holiday>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task DispatchAsync_SecondCallSameDay_DoesNotDoubleSend()
    {
        // AC5 — same day re-dispatch: 0 new sends, LastSentAt unchanged.
        await SeedUser();
        StubHoliday(Tbilisoba);

        await _sut.DispatchAsync(CancellationToken.None);
        var firstSentAt = Context.NotificationTriggers
            .First(t => t.UserId == TestTelegramId && t.Source == "holiday").LastSentAt;

        await _sut.DispatchAsync(CancellationToken.None);

        VerifyPushSent(Tbilisoba, Times.Once());
        var afterSecond = Context.NotificationTriggers
            .First(t => t.UserId == TestTelegramId && t.Source == "holiday").LastSentAt;
        afterSecond.ShouldBe(firstSentAt);
    }

    [Test]
    public async Task DispatchAsync_EasterHoliday_PassesEasterHolidayToNotificationService()
    {
        await SeedUser();
        StubHoliday(Easter);

        await _sut.DispatchAsync(CancellationToken.None);

        _notificationServiceMock.Verify(
            s => s.SendHolidayPushAsync(
                It.Is<User>(u => u.TelegramId == TestTelegramId),
                It.Is<Holiday>(h => h.Key == "easter" && h.GeorgianPhrase.Contains("ქრისტე აღდგა")),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task DispatchAsync_NoUsersInDb_DoesNotThrow()
    {
        StubHoliday(Tbilisoba);

        await Should.NotThrowAsync(() => _sut.DispatchAsync(CancellationToken.None));

        _notificationServiceMock.Verify(
            s => s.SendHolidayPushAsync(
                It.IsAny<User>(), It.IsAny<Holiday>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
