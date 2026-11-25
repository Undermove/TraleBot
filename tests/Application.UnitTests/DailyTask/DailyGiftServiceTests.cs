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
    private async Task<User> Learner(int streak = 3, bool done = true, bool lessonToday = false, DateTime? giftDaysAt = null, bool firstBox = false)
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(), UserId = user.Id, CompletedLessonsJson = "{}", Streak = streak, LastPlayedAtUtc = Now.AddHours(-1),
            GiftDaysAtUtc = firstBox ? null : giftDaysAt ?? Now.AddDays(-5),
            GiftLessonDay = lessonToday ? DateOnly.FromDateTime(Now) : DateOnly.FromDateTime(Now).AddDays(-1),
            CreatedAtUtc = Now, UpdatedAtUtc = Now
        });
        Context.DailyTaskStates.Add(new DailyTaskState
        {
            Id = Guid.NewGuid(), UserId = user.Id, Day = DateOnly.FromDateTime(Now),
            TaskJson = JsonSerializer.Serialize(new DailyTaskDto { Available = true, Day = "2026-11-20", Done = done, Extras = 3 }, Json),
            CreatedAtUtc = Now, UpdatedAtUtc = Now
        });
        await Context.SaveChangesAsync();
        return user;
    }

    private static readonly FakeTreasures Treasures = new();
    private DailyGiftService Sut => new(Context, Treasures);

    private sealed class FakeTreasures : ITreasureCatalog
    {
        public IReadOnlyList<TreasureWord> Words { get; } = [new("supra", "სუფრა", "супра", "застолье", "История.")];
        public IReadOnlyList<TreasureCard> Cards { get; } = [new("hi", "გამარჯობა", "гамарджоба", "привет", "просто так")];
    }

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

        var rolls = new Queue<double>([0.7, 0.0]); // сундучок, первый из его призов — заморозка
        var first = await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => rolls.Dequeue());
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
        var rolls2 = new Queue<double>([0.9, 0.5]);
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
        top.Value.Box.Prize.ShouldBe("item:scarf-kilim"); // вместо дней — золотая вещь для Бомборы

        var long_ago = await Learner(giftDaysAt: Now.AddDays(-31));
        var days = await Sut.OpenAsync(long_ago.Id, 0, Now, CancellationToken.None, () => 0.999);
        days!.Value.Box.Prize.ShouldBe("days");
        days.Value.Box.Days.ShouldBe(DailyGiftService.Days);
        Context.MiniAppUserProgresses.Single(p => p.UserId == long_ago.Id).GiftDaysAtUtc.ShouldBe(Now);
    }

    [Test]
    public async Task Lifetime_has_nothing_to_add_to_the_top_box_is_a_golden_thing()
    {
        var user = await Learner(firstBox: true);
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Lifetime;

        (await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => 0.999))!.Value.Box.Prize.ShouldStartWith("item:");
    }

    [Test]
    public async Task The_second_box_opens_for_a_module_lesson_today_not_for_extra_rounds()
    {
        var user = await Learner(lessonToday: false);
        (await Sut.OpenAsync(user.Id, 1, Now, CancellationToken.None)).ShouldBeNull();

        var other = await Learner(lessonToday: true);
        (await Sut.OpenAsync(other.Id, 1, Now, CancellationToken.None)).ShouldNotBeNull();
    }

    [Test]
    public async Task A_newcomer_without_a_daily_task_gets_the_lesson_box()
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(), UserId = user.Id, CompletedLessonsJson = "{}", Streak = 1, LastPlayedAtUtc = Now,
            GiftLessonDay = DateOnly.FromDateTime(Now), CreatedAtUtc = Now, UpdatedAtUtc = Now
        });
        await Context.SaveChangesAsync();

        var opened = await Sut.OpenAsync(user.Id, 1, Now, CancellationToken.None);

        opened!.Value.Box.Prize.ShouldBe("days");
        opened.Value.Box.Days.ShouldBe(DailyGiftService.FirstDays);
        (await Sut.GetAsync(user.Id, Now, CancellationToken.None)).Boxes[1].Opened.ShouldBeTrue();
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

    private static readonly User Plain = new() { InitialLanguageSet = true, RegisteredAtUtc = Now.AddDays(-90) };
    private static MiniAppUserProgress Had() => new() { GiftDaysAtUtc = Now.AddDays(-5), CompletedLessonsJson = "{}" };

    [Test]
    public void Collections_give_only_what_is_missing_and_fall_back_when_complete()
    {
        string[] words = ["a", "b"];
        var stash = new GiftStash { Words = ["a"] };
        var rolls = new Queue<double>([0.7, 0.5, 0.0]); // сундучок → слово → из оставшихся
        DailyGiftService.Draw(Had(), Plain, stash, 3, Now, () => rolls.Dequeue(), words).Prize.ShouldBe("word:b");

        stash.Words.Add("b");
        rolls = new Queue<double>([0.7, 0.5]);
        DailyGiftService.Draw(Had(), Plain, stash, 3, Now, () => rolls.Dequeue(), words).Prize.ShouldBe("freeze");

        var golden = new GiftStash { Items = GiftCatalog.Items.Where(i => i.Golden).Select(i => i.Id).ToList() };
        DailyGiftService.Draw(Had(), Plain, golden, 3, Now, () => 0.999).Prize.ShouldBe("friend");
    }

    [Test]
    public async Task A_new_thing_goes_on_bombora_if_the_slot_is_free_and_only_owned_things_can_be_worn()
    {
        var user = await Learner();
        var rolls = new Queue<double>([0.9, 0.9, 0.0]); // эмалевый → вещь → первая из обычных
        var opened = await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => rolls.Dequeue());

        opened!.Value.Box.Prize.ShouldBe("item:beret");
        var stash = await Sut.StashAsync(user.Id, CancellationToken.None);
        stash.Wear["head"].ShouldBe("beret");
        (await Sut.WearAsync(user.Id, "head", "crown", Now, CancellationToken.None)).ShouldBeNull();
        (await Sut.WearAsync(user.Id, "head", null, Now, CancellationToken.None))!.Wear.ContainsKey("head").ShouldBeFalse();
    }

    [Test]
    public async Task A_hint_is_spent_once()
    {
        var user = await Learner();
        var rolls = new Queue<double>([0.0, 0.5]); // коробка → подсказка
        (await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => rolls.Dequeue()))!.Value.Box.Prize.ShouldBe("hint");

        (await Sut.UseHintAsync(user.Id, Now, CancellationToken.None)).ShouldBe((true, 0));
        (await Sut.UseHintAsync(user.Id, Now, CancellationToken.None)).Ok.ShouldBeFalse();
    }

    [Test]
    public async Task A_treasure_word_lands_in_the_dictionary()
    {
        var user = await Learner();
        var rolls = new Queue<double>([0.7, 0.5, 0.0]); // сундучок → слово

        (await Sut.OpenAsync(user.Id, 0, Now, CancellationToken.None, () => rolls.Dequeue()))!.Value.Box.Prize.ShouldBe("word:supra");

        Context.VocabularyEntries.Single(e => e.UserId == user.Id).Word.ShouldBe("სუფრა");
    }
}
