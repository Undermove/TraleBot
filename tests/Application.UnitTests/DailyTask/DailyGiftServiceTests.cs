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
    private async Task<User> Learner(int streak = 3, bool done = true, int extras = 0)
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(), UserId = user.Id, CompletedLessonsJson = "{}", Streak = streak, LastPlayedAtUtc = Now.AddHours(-1),
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
    public async Task Epic_doubles_tomorrows_xp()
    {
        var user = await Learner();

        await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => 0.9); // streak 3: [.565,.292,.115,.028] → эпический

        Context.MiniAppUserProgresses.Single(p => p.UserId == user.Id).XpBoostDay.ShouldBe(DateOnly.FromDateTime(Now).AddDays(1));
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

    private async Task<string> FriendCode(User giver)
    {
        var opened = await Sut.OpenAsync(giver.Id, 0, Now, CancellationToken.None, () => 0.999);
        opened!.Value.Box.Prize.ShouldBe("friend");
        return opened.Value.Box.FriendCode!;
    }

    [Test]
    public async Task A_friend_gift_gives_days_once_and_a_person_takes_only_one_in_a_lifetime()
    {
        var giver = await Learner();
        var code = await FriendCode(giver);
        var friend = Create.User().Build();
        friend.RegisteredAtUtc = Now.AddDays(-90); // trial over
        var stranger = Create.User().Build();
        Context.Users.AddRange(friend, stranger);
        await Context.SaveChangesAsync();
        var activate = new ActivateFriendGiftService(Context);

        (await activate.ExecuteAsync(giver.Id, code, Now, CancellationToken.None)).Result.ShouldBe(ActivateFriendGiftResult.OwnGift);
        var taken = await activate.ExecuteAsync(friend.Id, code, Now, CancellationToken.None);
        taken.Result.ShouldBe(ActivateFriendGiftResult.Activated);
        friend.HasMiniAppAccess(Now.AddDays(6)).ShouldBeTrue();
        (await activate.ExecuteAsync(stranger.Id, code, Now, CancellationToken.None)).Result.ShouldBe(ActivateFriendGiftResult.AlreadyTaken);

        // The same giver tomorrow, another code — the friend cannot take a second one.
        var nextDay = await Learner();
        var second = await FriendCode(nextDay);
        (await activate.ExecuteAsync(friend.Id, second, Now, CancellationToken.None)).Result.ShouldBe(ActivateFriendGiftResult.AlreadyGotOne);
        (await activate.ExecuteAsync(stranger.Id, second, Now, CancellationToken.None)).Result.ShouldBe(ActivateFriendGiftResult.Activated);
    }
}
