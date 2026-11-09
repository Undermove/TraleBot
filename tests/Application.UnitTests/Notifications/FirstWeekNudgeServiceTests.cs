using Application.Common.Interfaces;
using Application.Common.Interfaces.MiniApp;
using Application.Notifications;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Notifications;

public class FirstWeekNudgeServiceTests : CommandTestsBase
{
    private static readonly DateTime Now = new(2026, 11, 20, 12, 0, 0, DateTimeKind.Utc);
    private Mock<IUserNotificationService> _sender = null!;
    private FirstWeekNudgeService _sut = null!;
    private readonly List<(long TelegramId, FirstWeekNudge Nudge)> _sent = [];
    private readonly List<(long TelegramId, string Text)> _offers = [];
    private Application.MiniApp.PriceSchedule _prices = new();
    private long _nextTelegramId = 92000;

    [SetUp]
    public void SetUp()
    {
        _sent.Clear();
        _offers.Clear();
        _prices = new Application.MiniApp.PriceSchedule { RiseAtUtc = Now.AddDays(-10) };
        _sender = new Mock<IUserNotificationService>();
        _sender.Setup(s => s.SendFirstWeekNudgeAsync(It.IsAny<User>(), It.IsAny<FirstWeekNudge>(), It.IsAny<CancellationToken>()))
            .Callback<User, FirstWeekNudge, CancellationToken>((u, n, _) => _sent.Add((u.TelegramId, n)))
            .Returns(Task.CompletedTask);
        _sender.Setup(s => s.SendEngagedOfferAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<User, string, string, CancellationToken>((u, t, b, _) => _offers.Add((u.TelegramId, t + "\n[" + b + "]")))
            .Returns(Task.CompletedTask);
        var content = new Mock<IMiniAppContentProvider>();
        // In the alphabet the words lesson 12 comes right after letters lesson 1.
        content.Setup(c => c.LessonOrder("alphabet-progressive")).Returns(
        [
            new LessonOutline(1, "Первые буквы", "Три буквы — и первые слова."),
            new LessonOutline(12, "Слова: და (да)", "Прочитаешь слова целиком."),
            new LessonOutline(2, "Ещё буквы", "Ещё три буквы.")
        ]);
        content.Setup(c => c.LessonOrder("numbers")).Returns([new LessonOutline(1, "До десяти", "Считаешь до десяти.")]);
        content.Setup(c => c.LessonOrder(It.IsNotIn("alphabet-progressive", "numbers"))).Returns([]);
        content.Setup(c => c.ModuleTitle("alphabet-progressive")).Returns("Алфавит");
        content.Setup(c => c.ModuleTitle("numbers")).Returns("Числа");
        _sut = new FirstWeekNudgeService(Context, content.Object, _sender.Object, _prices, NullLoggerFactory.Instance);
    }

    private async Task SwitchedOnLongAgo() => await _sut.DispatchAsync(Now.AddDays(-30), CancellationToken.None);

    private async Task<User> Newcomer(DateTime registeredAt, string? completed = """{"alphabet-progressive":[1]}""", DateTime? lastPlayed = null)
    {
        var user = Create.User().Build();
        user.TelegramId = _nextTelegramId++;
        user.RegisteredAtUtc = registeredAt;
        user.IsActive = true;
        user.NotificationsEnabled = true;
        Context.Users.Add(user);
        if (completed != null)
            Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
            {
                Id = Guid.NewGuid(), UserId = user.Id, CompletedLessonsJson = completed,
                LastPlayedAtUtc = lastPlayed ?? registeredAt.AddMinutes(10),
                CreatedAtUtc = registeredAt, UpdatedAtUtc = registeredAt
            });
        await Context.SaveChangesAsync();
        return user;
    }

    private IEnumerable<FirstWeekNudge> SentTo(User user) => _sent.Where(s => s.TelegramId == user.TelegramId).Select(s => s.Nudge);

    [Test]
    public async Task First_run_after_the_release_messages_nobody_from_the_existing_base()
    {
        var old = await Newcomer(Now.AddHours(-24));

        await _sut.DispatchAsync(Now, CancellationToken.None);

        SentTo(old).ShouldBeEmpty();
    }

    [Test]
    public async Task Day_one_points_at_the_next_lesson_in_the_module_order_once()
    {
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddHours(-24));

        await _sut.DispatchAsync(Now, CancellationToken.None);
        await _sut.DispatchAsync(Now.AddHours(1), CancellationToken.None);

        var nudge = SentTo(user).ShouldHaveSingleItem();
        nudge.Day.ShouldBe(1);
        nudge.ModuleId.ShouldBe("alphabet-progressive");
        nudge.LessonId.ShouldBe(12, "after letters lesson 1 come its words, not letters lesson 2");
        nudge.Text.ShouldContain("«Слова: და (да)» — Алфавит");
        nudge.Text.ShouldContain("Хорошее начало");
    }

    [Test]
    public async Task Days_three_and_seven_come_at_the_hour_of_registration()
    {
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddDays(-7), """{"alphabet-progressive":[1,12]}""");

        await _sut.DispatchAsync(Now.AddDays(-6), CancellationToken.None);
        await _sut.DispatchAsync(Now.AddDays(-4), CancellationToken.None);
        await _sut.DispatchAsync(Now, CancellationToken.None);

        SentTo(user).Select(n => n.Day).ShouldBe([1, 3, 7]);
        SentTo(user).Last().Text.ShouldContain("Уроков пройдено: 2");
        SentTo(user).Last().LessonId.ShouldBe(2);
    }

    [Test]
    public async Task Whoever_studied_in_the_last_twenty_hours_is_left_alone_that_day()
    {
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddHours(-24), lastPlayed: Now.AddHours(-3));

        await _sut.DispatchAsync(Now, CancellationToken.None);

        SentTo(user).ShouldBeEmpty();
    }

    [Test]
    public async Task Someone_who_never_opened_the_mini_app_is_left_to_the_first_open_reminder()
    {
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddHours(-24), completed: null);

        await _sut.DispatchAsync(Now, CancellationToken.None);

        SentTo(user).ShouldBeEmpty();
    }

    [Test]
    public async Task Without_a_finished_lesson_the_first_alphabet_lesson_is_offered()
    {
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddHours(-24), "{}");

        await _sut.DispatchAsync(Now, CancellationToken.None);

        var nudge = SentTo(user).ShouldHaveSingleItem();
        nudge.LessonId.ShouldBe(1);
        nudge.Text.ShouldContain("на первом уроке");
    }

    [Test]
    public async Task The_module_gone_furthest_in_is_continued()
    {
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddHours(-24), """{"alphabet-progressive":[1,12],"numbers":[]}""");

        await _sut.DispatchAsync(Now, CancellationToken.None);

        SentTo(user).ShouldHaveSingleItem().ModuleId.ShouldBe("alphabet-progressive");
    }

    [Test]
    public async Task A_day_missed_by_more_than_a_day_is_skipped()
    {
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddHours(-49));

        await _sut.DispatchAsync(Now, CancellationToken.None);

        SentTo(user).ShouldBeEmpty();
    }

    [Test]
    public async Task Bot_blocked_or_notifications_off_get_nothing()
    {
        await SwitchedOnLongAgo();
        var blocked = await Newcomer(Now.AddHours(-24));
        blocked.IsActive = false;
        var quiet = await Newcomer(Now.AddHours(-24));
        quiet.NotificationsEnabled = false;
        await Context.SaveChangesAsync();

        await _sut.DispatchAsync(Now, CancellationToken.None);

        _sent.ShouldBeEmpty();
    }

    // ── Day 7: the old prices for whoever studies in earnest ─────────────────

    private async Task Studied(User user, params (int Day, int Lessons)[] days)
    {
        foreach (var (day, lessons) in days)
            for (var i = 0; i < lessons; i++)
                Context.LessonEvents.Add(new LessonEvent
                {
                    Id = Guid.NewGuid(), UserId = user.Id, ModuleId = "alphabet-progressive", LessonId = i + 1,
                    StepKind = "check", Event = "lesson_complete", CreatedAtUtc = user.RegisteredAtUtc.AddDays(day).AddMinutes(i)
                });
        await Context.SaveChangesAsync();
    }

    [Test]
    public async Task Five_lessons_on_two_days_get_the_offer_instead_of_the_day_seven_message()
    {
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddDays(-7), lastPlayed: Now.AddHours(-2));
        await Studied(user, (0, 3), (2, 3));

        await _sut.DispatchAsync(Now, CancellationToken.None);
        await _sut.DispatchAsync(Now.AddHours(1), CancellationToken.None);

        var offer = _offers.ShouldHaveSingleItem();
        offer.Text.ShouldContain("Уроков за неделю: 6");
        offer.Text.ShouldContain("3 месяца — 249 ⭐ вместо 349 ⭐");
        offer.Text.ShouldContain("до 23 ноября, 16:00 по Тбилиси");
        offer.Text.ShouldContain("Купи сейчас по сниженной цене");
        offer.Text.ShouldContain("[Купить по сниженной цене]");
        SentTo(user).ShouldBeEmpty("the offer stands in for the day-7 message");
        Context.NotificationTriggers.Single(t => t.UserId == user.TelegramId && t.Source == Application.MiniApp.PriceSchedule.OfferSource)
            .LastSentAt.ShouldBe(Now);
    }

    [Test]
    public async Task Before_the_rise_the_offer_says_the_price_stays_for_good()
    {
        _prices = new Application.MiniApp.PriceSchedule { RiseAtUtc = new DateTime(2026, 11, 30, 20, 0, 0, DateTimeKind.Utc) };
        SetUp_with_prices();
        await SwitchedOnLongAgo();
        var user = await Newcomer(Now.AddDays(-7));
        await Studied(user, (1, 2), (3, 3));

        await _sut.DispatchAsync(Now, CancellationToken.None);

        var text = _offers.ShouldHaveSingleItem().Text;
        text.ShouldContain("С 1 декабря цены вырастут");
        text.ShouldContain("3 месяца — 249 ⭐ (потом 349 ⭐)");
        text.ShouldContain("навсегда");
        text.ShouldContain("[Купить по старой цене]");
    }

    [Test]
    public async Task Lessons_on_one_day_or_fewer_than_five_get_the_ordinary_day_seven_message()
    {
        await SwitchedOnLongAgo();
        var oneDay = await Newcomer(Now.AddDays(-7));
        await Studied(oneDay, (0, 8));
        var few = await Newcomer(Now.AddDays(-7));
        await Studied(few, (0, 2), (3, 2));

        await _sut.DispatchAsync(Now, CancellationToken.None);

        _offers.ShouldBeEmpty();
        SentTo(oneDay).ShouldHaveSingleItem().Day.ShouldBe(7);
        SentTo(few).ShouldHaveSingleItem().Day.ShouldBe(7);
    }

    [Test]
    public async Task Whoever_paid_or_has_pro_gets_no_offer()
    {
        await SwitchedOnLongAgo();
        var paid = await Newcomer(Now.AddDays(-7));
        await Studied(paid, (0, 3), (2, 3));
        Context.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(), UserId = paid.Id, TelegramPaymentChargeId = "c1", PayloadId = "Stars_Pro_Month",
            Plan = SubscriptionPlan.Month, Amount = 100, Currency = "XTR", PurchasedAtUtc = Now.AddDays(-1)
        });
        var gifted = await Newcomer(Now.AddDays(-7));
        gifted.IsPro = true;
        gifted.SubscriptionPlan = SubscriptionPlan.Month;
        gifted.SubscribedUntil = Now.AddDays(20);
        await Context.SaveChangesAsync();
        await Studied(gifted, (0, 3), (2, 3));

        await _sut.DispatchAsync(Now, CancellationToken.None);

        _offers.ShouldBeEmpty();
    }

    private void SetUp_with_prices()
    {
        var content = new Mock<IMiniAppContentProvider>();
        content.Setup(c => c.LessonOrder(It.IsAny<string>())).Returns([new LessonOutline(1, "Первые буквы", "Три буквы.")]);
        content.Setup(c => c.ModuleTitle(It.IsAny<string>())).Returns("Алфавит");
        _sut = new FirstWeekNudgeService(Context, content.Object, _sender.Object, _prices, NullLoggerFactory.Instance);
    }
}
