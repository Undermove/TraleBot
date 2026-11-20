using System.Text.Json;
using Application.DailyTask;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.DailyTask;

public class DailyGiftServiceTests : CommandTestsBase
{
    private static readonly DateTime Now = new(2026, 11, 20, 12, 0, 0, DateTimeKind.Utc);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>A learner who played today with <paramref name="streak"/> days in a row; <paramref name="done"/> — today's task finished.</summary>
    private async Task<User> Learner(int streak = 3, bool done = true, int extras = 0, DateTime? giftDaysAt = null, bool firstBox = false)
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(), UserId = user.Id, CompletedLessonsJson = "{}", Streak = streak, LastPlayedAtUtc = Now.AddHours(-1),
            GiftDaysAtUtc = firstBox ? null : giftDaysAt ?? Now.AddDays(-5),
            CreatedAtUtc = Now, UpdatedAtUtc = Now
        });
        Context.DailyTaskStates.Add(new DailyTaskState
        {
            Id = Guid.NewGuid(), UserId = user.Id, Day = DateOnly.FromDateTime(Now),
            TaskJson = JsonSerializer.Serialize(new DailyTaskDto { Available = true, Day = "2026-11-20", Done = done, Extras = extras }, Json),
            CreatedAtUtc = Now, UpdatedAtUtc = Now
        });
        await Context.SaveChangesAsync();
        return user;
    }

    private DailyGiftService Sut => new(Context);

    [Test]
    public void Odds_always_add_up_to_one_and_grow_rarer_with_the_streak()
    {
        foreach (var d in new[] { 1, 3, 6, 7, 13, 14, 30, 100 })
        {
            DailyGiftService.Odds(d).Sum().ShouldBe(1, 1e-9);
        }

        DailyGiftService.Odds(20)[3].ShouldBeGreaterThan(DailyGiftService.Odds(2)[3]);
        DailyGiftService.Odds(20)[0].ShouldBeLessThan(DailyGiftService.Odds(2)[0]);
    }

    [Test]
    public void Every_seventh_day_gives_epic_or_better()
    {
        DailyGiftService.Odds(7)[0].ShouldBe(0);
        DailyGiftService.Odds(14)[1].ShouldBe(0);
        DailyGiftService.Roll(DailyGiftService.Odds(7), 0.01).ShouldBe(2);
        DailyGiftService.Roll(DailyGiftService.Odds(7), 0.99).ShouldBe(3);
    }

    [Test]
    public async Task The_box_stays_shut_until_the_task_is_done()
    {
        var user = await Learner(done: false);

        (await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None)).ShouldBeNull();
        (await Sut.GetAsync(user.Id, Now, CancellationToken.None)).Boxes[0].Ready.ShouldBeFalse();
    }

    [Test]
    public async Task The_prize_is_drawn_once_reopening_returns_the_same_one()
    {
        var user = await Learner();

        var first = await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => 0.7); // редкий: заморозка
        var again = await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => 0.0);

        first!.Value.Box.Prize.ShouldBe("freeze");
        again!.Value.Box.Prize.ShouldBe("freeze");
        Context.MiniAppUserProgresses.Single(p => p.UserId == user.Id).StreakFreezes.ShouldBe(1);
    }

    [Test]
    public async Task Churchkhela_feeds_Bombora_for_free()
    {
        var user = await Learner();

        var opened = await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => 0.0);

        opened!.Value.Box.Prize.ShouldBe("churchkhela");
        var progress = Context.MiniAppUserProgresses.Single(p => p.UserId == user.Id);
        progress.LastTreatIndex.ShouldBe(DailyGiftService.ChurchkhelaIndex);
        progress.XpSpent.ShouldBe(0);
    }

    [Test]
    public async Task Epic_is_double_xp_tomorrow_or_an_invite()
    {
        var user = await Learner();
        var rolls = new Queue<double>([0.9, 0.2]); // streak 3: [.565,.292,.115,.028] → эпический; затем половина — ×2

        await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => rolls.Dequeue());

        Context.MiniAppUserProgresses.Single(p => p.UserId == user.Id).XpBoostDay.ShouldBe(DateOnly.FromDateTime(Now).AddDays(1));
        var other = await Learner();
        var rolls2 = new Queue<double>([0.9, 0.8]);
        (await Sut.OpenAsync(other.Id, 0, Now, CancellationToken.None, () => rolls2.Dequeue()))!.Value.Box.Prize.ShouldBe("friend");
    }

    [Test]
    public async Task The_very_first_box_is_golden_with_three_free_days()
    {
        var user = await Learner(firstBox: true);
        user.RegisteredAtUtc = Now.AddDays(-90); // триал давно кончился

        var opened = await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => 0.0);

        opened!.Value.Box.Rarity.ShouldBe(3);
        opened.Value.Box.Prize.ShouldBe("days");
        opened.Value.Box.Days.ShouldBe(DailyGiftService.FirstDays);
        user.HasMiniAppAccess(Now.AddDays(2.5)).ShouldBeTrue();
        user.HasMiniAppAccess(Now.AddDays(3.5)).ShouldBeFalse();
    }

    [Test]
    public async Task Free_days_drop_at_most_once_a_month_otherwise_the_top_box_is_an_invite()
    {
        var recent = await Learner(giftDaysAt: Now.AddDays(-10));
        var top = await Sut.OpenAsync(recent.Id, 0, Now, CancellationToken.None, () => 0.999);
        top!.Value.Box.Rarity.ShouldBe(3);
        top.Value.Box.Prize.ShouldBe("friend");

        var long_ago = await Learner(giftDaysAt: Now.AddDays(-31));
        var days = await Sut.OpenAsync(long_ago.Id, 0, Now, CancellationToken.None, () => 0.999);
        days!.Value.Box.Prize.ShouldBe("days");
        days.Value.Box.Days.ShouldBe(DailyGiftService.Days);
        Context.MiniAppUserProgresses.Single(p => p.UserId == long_ago.Id).GiftDaysAtUtc.ShouldBe(Now);
    }

    [Test]
    public async Task Lifetime_has_nothing_to_add_to_the_top_box_is_an_invite()
    {
        var user = await Learner(firstBox: true);
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Lifetime;

        (await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => 0.999))!.Value.Box.Prize.ShouldBe("friend");
    }

    [Test]
    public async Task The_second_box_opens_after_one_more_round()
    {
        var user = await Learner(extras: 0);
        (await Sut.OpenAsync(user.Id, 1, Now, CancellationToken.None)).ShouldBeNull();

        var other = await Learner(extras: 1);
        (await Sut.OpenAsync(other.Id, 1, Now, CancellationToken.None)).ShouldNotBeNull();
    }

    [Test]
    public async Task A_missed_day_drops_the_odds_unless_a_freeze_covers_it()
    {
        var user = await Learner(streak: 6);
        var progress = Context.MiniAppUserProgresses.Single(p => p.UserId == user.Id);
        progress.LastPlayedAtUtc = Now.AddDays(-2);

        DailyGiftService.StreakOfToday(progress, DateOnly.FromDateTime(Now)).ShouldBe(1);
        progress.StreakFreezes = 1;
        DailyGiftService.StreakOfToday(progress, DateOnly.FromDateTime(Now)).ShouldBe(7);
    }
}
