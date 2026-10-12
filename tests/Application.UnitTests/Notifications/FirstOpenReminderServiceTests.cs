using Application.Common.Interfaces;
using Application.Notifications;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Notifications;

public class FirstOpenReminderServiceTests : CommandTestsBase
{
    private static readonly DateTime Now = new(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc);
    private Mock<IUserNotificationService> _sender = null!;
    private FirstOpenReminderService _sut = null!;
    private long _nextTelegramId = 91000;

    [SetUp]
    public void SetUp()
    {
        _sender = new Mock<IUserNotificationService>();
        _sut = new FirstOpenReminderService(Context, _sender.Object, NullLoggerFactory.Instance);
    }

    private async Task<User> Registered(DateTime at)
    {
        var user = Create.User().Build();
        user.TelegramId = _nextTelegramId++;
        user.RegisteredAtUtc = at;
        user.IsActive = true;
        user.NotificationsEnabled = true;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        return user;
    }

    private void Reminded(User user, Times times) =>
        _sender.Verify(s => s.SendFirstOpenReminderAsync(
            It.Is<User>(u => u.Id == user.Id), It.IsAny<CancellationToken>()), times);

    [Test]
    public async Task First_run_after_the_release_reminds_nobody_and_remembers_when_it_was()
    {
        var user = await Registered(Now.AddHours(-25));

        await _sut.DispatchAsync(Now, CancellationToken.None);
        await _sut.DispatchAsync(Now.AddHours(1), CancellationToken.None);

        Reminded(user, Times.Never());
        Context.NotificationTriggers
            .Single(t => t.Source == FirstOpenReminderService.SwitchedOnSource).LastSentAt.ShouldBe(Now);
    }

    [Test]
    public async Task Newcomer_registered_after_the_switch_on_is_reminded_once()
    {
        await _sut.DispatchAsync(Now.AddDays(-3), CancellationToken.None);
        var user = await Registered(Now.AddHours(-24));

        await _sut.DispatchAsync(Now, CancellationToken.None);
        await _sut.DispatchAsync(Now.AddHours(1), CancellationToken.None);

        Reminded(user, Times.Once());
    }

    [Test]
    public async Task Reminder_that_is_three_days_late_is_not_sent()
    {
        // The worker was down: reminding about «yesterday» three days later is noise.
        await _sut.DispatchAsync(Now.AddDays(-10), CancellationToken.None);
        var user = await Registered(Now.AddHours(-73));

        await _sut.DispatchAsync(Now, CancellationToken.None);

        Reminded(user, Times.Never());
    }

    [Test]
    public async Task Newcomer_who_opened_the_mini_app_is_not_reminded()
    {
        await _sut.DispatchAsync(Now.AddDays(-3), CancellationToken.None);
        var user = await Registered(Now.AddHours(-30));
        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(), UserId = user.Id, CompletedLessonsJson = "{}",
            CreatedAtUtc = Now.AddHours(-29), UpdatedAtUtc = Now.AddHours(-29)
        });
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(Now, CancellationToken.None);

        Reminded(user, Times.Never());
    }

    [Test]
    public async Task Person_who_blocked_the_bot_at_the_reminder_stays_marked_as_gone()
    {
        await _sut.DispatchAsync(Now.AddDays(-3), CancellationToken.None);
        var user = await Registered(Now.AddHours(-30));
        _sender
            .Setup(s => s.SendFirstOpenReminderAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .Callback<User, CancellationToken>((u, _) => u.IsActive = false)
            .Returns(Task.CompletedTask);

        await _sut.DispatchAsync(Now, CancellationToken.None);

        Context.ChangeTracker.Clear();
        Context.Users.Single(u => u.Id == user.Id).IsActive.ShouldBeFalse();
    }
}
