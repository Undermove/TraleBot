using Application.Common.Interfaces;
using Application.Common.Interfaces.MiniApp;
using Application.DailyTask;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Application.Verbs;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.DailyTask;

public class DailyTaskReminderServiceTests : CommandTestsBase
{
    // 15:00 UTC = 19:00 Tbilisi — the default hour for someone without a habit yet.
    private static readonly DateTime Evening = new(2026, 11, 17, 15, 0, 0, DateTimeKind.Utc);
    private const long Owner = 309149393;
    private Mock<IUserNotificationService> _sender = null!;
    private long _nextTelegramId = 92000;

    [SetUp]
    public void SetUp() => _sender = new Mock<IUserNotificationService>();

    private DailyTaskReminderService Sut(bool everyone = false)
    {
        var catalog = new Mock<ICourseCatalog>();
        catalog.Setup(c => c.Modules()).Returns([]);
        var daily = new DailyTaskService(Context, new VerbProgressService(Context), Mock.Of<IProgressCalculator>(), catalog.Object);
        return new DailyTaskReminderService(Context, daily, new DailyTaskAudience(everyone, [Owner]), _sender.Object, NullLoggerFactory.Instance);
    }

    /// <summary>Someone with three Georgian words in the dictionary — enough for a task.</summary>
    private async Task<User> Learner(long? telegramId = null, DateTime? lastPlayed = null)
    {
        var user = Create.User().Build();
        user.TelegramId = telegramId ?? _nextTelegramId++;
        user.IsActive = true;
        user.NotificationsEnabled = true;
        Context.Users.Add(user);
        foreach (var (ka, ru) in new[] { ("ხე", "дерево"), ("წყალი", "вода"), ("სახლი", "дом") })
        {
            Context.VocabularyEntries.Add(Create.VocabularyEntry().WithUser(user).WithWord(ka).WithDefinition(ru)
                .WithDateAdded(Evening.AddDays(-2)).WithUpdatedAt(Evening.AddDays(-2)).Build());
        }

        if (lastPlayed != null)
        {
            Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
            {
                Id = Guid.NewGuid(), UserId = user.Id, CompletedLessonsJson = "{}", LastPlayedAtUtc = lastPlayed,
                CreatedAtUtc = lastPlayed.Value, UpdatedAtUtc = lastPlayed.Value
            });
        }

        await Context.SaveChangesAsync();
        return user;
    }

    private void Reminded(User user, Times times) =>
        _sender.Verify(s => s.SendDailyTaskReminderAsync(
            It.Is<User>(u => u.Id == user.Id), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), times);

    [Test]
    public async Task The_owner_gets_todays_task_once_a_day_with_its_words_and_button()
    {
        var owner = await Learner(Owner);
        string? text = null, button = null;
        _sender.Setup(s => s.SendDailyTaskReminderAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<User, string, string, CancellationToken>((_, t, b, _) => { text = t; button = b; });

        await Sut().DispatchAsync(Evening, CancellationToken.None);
        await Sut().DispatchAsync(Evening.AddHours(1), CancellationToken.None);

        Reminded(owner, Times.Once());
        var task = Context.DailyTaskStates.Single(s => s.UserId == owner.Id);
        task.TaskJson.ShouldNotBeNull();
        text.ShouldNotBeNullOrWhiteSpace();
        button.ShouldBe("Повторить");

        await Sut().DispatchAsync(Evening.AddDays(1), CancellationToken.None);
        Reminded(owner, Times.Exactly(2));
    }

    [Test]
    public async Task Nobody_else_gets_it_while_it_is_tried_out_by_the_owner()
    {
        var someone = await Learner();

        await Sut().DispatchAsync(Evening, CancellationToken.None);

        Reminded(someone, Times.Never());
    }

    [Test]
    public async Task On_the_stand_the_task_is_open_to_everyone_but_the_bot_writes_only_to_the_listed()
    {
        var someone = await Learner();
        var owner = await Learner(Owner);

        await Sut(everyone: true).DispatchAsync(Evening, CancellationToken.None);

        Reminded(someone, Times.Never());
        Reminded(owner, Times.Once());
    }

    [Test]
    public async Task It_comes_at_the_hour_the_person_usually_studies()
    {
        // Studied yesterday at 08:20 UTC (12:20 Tbilisi) — the reminder waits for 08:00 UTC.
        var owner = await Learner(Owner, lastPlayed: Evening.Date.AddDays(-1).AddHours(8).AddMinutes(20));

        await Sut().DispatchAsync(Evening.Date.AddHours(7), CancellationToken.None);
        Reminded(owner, Times.Never());

        await Sut().DispatchAsync(Evening.Date.AddHours(8), CancellationToken.None);
        Reminded(owner, Times.Once());
    }

    [Test]
    public async Task Not_at_night_and_not_when_the_task_is_done()
    {
        var owner = await Learner(Owner);

        await Sut().DispatchAsync(Evening.Date.AddHours(19), CancellationToken.None);
        Reminded(owner, Times.Never());

        var daily = Sut();
        var task = await new DailyTaskService(Context, new VerbProgressService(Context), Mock.Of<IProgressCalculator>(), Mock.Of<ICourseCatalog>(c => c.Modules() == new List<CourseModule>()))
            .GetAsync(owner, Evening.AddHours(-3), false, CancellationToken.None);
        var state = Context.DailyTaskStates.Single(s => s.UserId == owner.Id);
        state.TaskJson = System.Text.Json.JsonSerializer.Serialize(task with { Done = true }, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
        await Context.SaveChangesAsync();

        await daily.DispatchAsync(Evening, CancellationToken.None);
        Reminded(owner, Times.Never());
    }

    [TestCase(null, 15)]
    [TestCase(3, 6)]
    [TestCase(11, 11)]
    [TestCase(20, 17)]
    public void The_hour_is_kept_within_the_day(int? lastHourUtc, int expected)
    {
        DateTime? last = lastHourUtc is { } h ? Evening.Date.AddHours(h) : null;
        DailyTaskReminderService.SendHourUtc(last).ShouldBe(expected);
    }
}
