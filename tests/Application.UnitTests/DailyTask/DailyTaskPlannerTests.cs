using Application.DailyTask;
using Shouldly;

namespace Application.UnitTests.DailyTask;

public class DailyTaskPlannerTests
{
    private static readonly DateTime Now = new(2026, 11, 16, 12, 0, 0, DateTimeKind.Utc);

    private static DailyForm Form(string lemma, string tense, int person, int step, int best = 0, DateTime? due = null, int daysAgo = 1) =>
        new(lemma, lemma + "-ru", tense, person, $"{lemma}{tense[0]}{person}", $"{lemma} {tense} {person}",
            step, Math.Max(step, best), 0, due, Now.AddDays(-daysAgo));

    private static List<DailyForm> Verb(string lemma, int step, int daysAgo = 1) =>
        Enumerable.Range(0, 6).Select(p => Form(lemma, "present", p, step, daysAgo: daysAgo)).ToList();

    [Test]
    public void A_week_away_gives_the_easy_comeback_with_the_best_known_forms()
    {
        var forms = Verb("a", 2).Append(Form("b", "present", 0, 6)).ToList();

        var task = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Away = 9, Accuracy = 95, Forms = forms });

        task.Mode.ShouldBe(DailyMode.Comeback);
        task.Level.ShouldBe(1);
        task.Warm.ShouldBeEmpty();
        task.Pairs.Count.ShouldBe(3);
        task.Pairs[0].Key.ShouldBe("v:b:present:0");
        task.Chat[0].ShouldBe("Давно не виделись: тебя не было 9 дней.");
    }

    [Test]
    public void Many_mistakes_yesterday_repeat_the_missed_forms_without_anything_new()
    {
        var forms = Verb("a", 3);
        var task = DailyTaskPlanner.Compose(new DailyInput
        {
            Now = Now, Accuracy = 80, LastErrors = 4, LastTaskYesterday = true,
            Missed = ["v:a:present:5"], Forms = forms,
            Course = new DailyNew(DailyNew.Lesson, "Падежи", "урок 8 из 10", "…", "Пройти урок")
        });

        task.Mode.ShouldBe(DailyMode.Review);
        task.Pairs[0].Key.ShouldBe("v:a:present:5");
        task.Next.ShouldBeNull();
        task.Chat[0].ShouldBe("Вчера в игре было много ошибок.");
    }

    [Test]
    public void Due_forms_open_the_warm_up_and_their_options_come_from_the_same_verb()
    {
        var forms = Verb("a", 2).Append(Form("b", "present", 0, 6, due: Now.AddHours(-1))).Append(Form("b", "present", 1, 4)).ToList();

        var task = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Accuracy = 90, Forms = forms });

        task.Mode.ShouldBe(DailyMode.Mix);
        task.Level.ShouldBe(3);
        task.Warm.Count.ShouldBe(1);
        task.Warm[0].Due.ShouldBeTrue();
        task.Warm[0].Options.Count(o => o.Ok).ShouldBe(1);
        task.Warm[0].Options.ShouldContain(o => o.Ru == "b present 1");
        task.Pairs.ShouldNotContain(p => p.Key == "v:b:present:0");
        task.Chat[0].ShouldStartWith("У глагола «b-ru» 1 форма ждёт повторения");
    }

    [Test]
    public void Slipped_forms_come_first_in_the_game()
    {
        var forms = Verb("a", 2).Append(Form("c", "aorist", 3, 2, best: 5)).ToList();

        var task = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Accuracy = 70, Forms = forms });

        task.Level.ShouldBe(1);
        task.Pairs[0].Key.ShouldBe("v:c:aorist:3");
        task.Chat[0].ShouldContain("стала получаться хуже");
    }

    [Test]
    public void A_long_unseen_verb_is_brought_back_in_the_warm_up()
    {
        var forms = Verb("a", 2).Concat(Verb("old", 6, daysAgo: 30).Select(f => f with { DueAtUtc = Now.AddDays(5) })).ToList();

        var task = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Accuracy = 80, Forms = forms });

        task.Warm.ShouldNotBeEmpty();
        task.Warm.ShouldAllBe(r => r.Item.Lemma == "old" && !r.Due);
        task.Chat[0].ShouldContain("Глагол «old-ru» без практики с 17 октября");
    }

    [Test]
    public void Words_from_the_dictionary_join_the_game_from_the_middle_level()
    {
        var words = new List<DailyWord>
        {
            new(Guid.NewGuid(), "ხე", "дерево", 0, 0, Now.AddDays(-2), Now.AddDays(-2)),
            new(Guid.NewGuid(), "წყალი", "вода", 1, 3, Now.AddDays(-40), Now.AddDays(-3))
        };

        var task = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Accuracy = 80, Forms = Verb("a", 2), Words = words });

        task.Level.ShouldBe(2);
        task.Pairs.Count(p => p.Kind == "word").ShouldBe(1);
        task.Pairs.Count.ShouldBe(4);
        task.Chat[1].ShouldStartWith("Повтори сегодня 3 формы и 1 слово из своего словаря.");
    }

    [Test]
    public void Fresh_forms_and_the_course_take_turns()
    {
        var forms = Verb("a", 2);
        var course = new DailyNew(DailyNew.Lesson, "Падежи", "урок 8 из 10", "…", "Пройти урок");
        var unopened = new List<DailyUnopened>
        {
            new("b", "b-ru", [new DailyFresh("present", 0, "b сейчас")]),
            new("a", "a-ru", [new DailyFresh("aorist", 0, "я сделал"), new DailyFresh("aorist", 2, "он сделал")])
        };

        var afterLesson = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Accuracy = 80, Forms = forms, Unopened = unopened, Course = course, LastNew = "lesson" });
        var afterForms = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Accuracy = 80, Forms = forms, Unopened = unopened, Course = course, LastNew = "forms" });

        afterLesson.Next!.Kind.ShouldBe(DailyNew.Forms);
        afterLesson.Next.VerbId.ShouldBe("a");
        afterLesson.Next.Line.ShouldBe("я сделал · он сделал");
        afterLesson.Next.Say.ShouldContain("2 новые формы: «я сделал», «он сделал»");
        afterForms.Next.ShouldBe(course);
    }

    [Test]
    public void The_check_asks_for_one_form_of_the_game_among_forms_of_the_same_verb()
    {
        var task = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Accuracy = 90, Forms = Verb("a", 2) });

        task.Check.Picks.Count.ShouldBe(3);
        task.Check.Picks.Count(p => p.Ok).ShouldBe(1);
        task.Check.Picks.ShouldAllBe(p => p.Item.Lemma == "a");
        var key = task.Check.Picks.Single(p => p.Ok).Item;
        task.Pairs.ShouldContain(p => p.Key == key.Key);
        task.Check.Prompt.ShouldBe($"Нажми форму, которая значит «{key.Ru}»");
    }

    [Test]
    public void After_the_pairs_the_learner_goes_back_from_russian_into_georgian()
    {
        var forms = Verb("a", 2).Concat(Verb("b", 3)).ToList();

        var task = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Accuracy = 80, Forms = forms });

        task.Level.ShouldBe(2);
        task.Back.Count.ShouldBe(4);
        var checkKey = task.Check.Picks.Single(p => p.Ok).Item.Key;
        foreach (var round in task.Back)
        {
            round.Item.Key.ShouldNotBe(checkKey);
            round.Options.Count.ShouldBe(3);
            round.Options.Single(o => o.Ok).Item.Key.ShouldBe(round.Item.Key);
            round.Options.Select(o => o.Item.Ka).Distinct().Count().ShouldBe(3);
            // The options are forms of the same verb in the same tense: only the meaning tells them apart.
            round.Options.ShouldAllBe(o => o.Item.Lemma == round.Item.Lemma);
        }
    }

    [Test]
    public void An_extra_round_takes_what_was_practised_longest_ago_and_skips_todays_task()
    {
        var forms = Verb("a", 3, daysAgo: 0).Concat(Verb("b", 3, daysAgo: 10)).ToList();
        var today = forms.Where(f => f.Lemma == "a").Select(f => f.Key).ToHashSet();

        var extra = DailyTaskPlanner.Extra(new DailyInput { Now = Now, Accuracy = 80, Forms = forms }, today);

        extra.ShouldNotBeNull();
        extra.Title.ShouldBe("Ещё раунд");
        extra.Warm.ShouldBeEmpty();
        extra.Next.ShouldBeNull();
        extra.Pairs.Count.ShouldBe(4);
        extra.Pairs.ShouldAllBe(p => p.Lemma == "b");
        extra.Back.ShouldNotBeEmpty();
    }

    [Test]
    public void No_extra_round_when_everything_was_played_today()
    {
        var forms = Verb("a", 3);

        DailyTaskPlanner.Extra(new DailyInput { Now = Now, Forms = forms }, forms.Select(f => f.Key).ToHashSet()).ShouldBeNull();
    }

    [Test]
    public void The_push_names_one_fact_about_today_and_the_facts_take_turns()
    {
        var forms = Verb("a", 2).Append(Form("c", "aorist", 3, 2, best: 5)).Append(Form("b", "present", 0, 6, due: Now.AddHours(-1))).ToList();
        var input = new DailyInput { Now = Now, Accuracy = 80, Streak = 4, PlayedYesterday = true, Forms = forms };

        var variants = Enumerable.Range(0, 3)
            .Select(d => DailyTaskPlanner.Compose(input with { Now = Now.AddDays(d) }).Push!)
            .ToList();

        variants.Select(p => p.Variant).ShouldBe(["slip", "due", "streak"], ignoreOrder: true);
        variants.Single(p => p.Variant == "streak").Headline.ShouldBe("🔥 5 дней подряд — продли серию");
        variants.ShouldAllBe(p => p.Headline.Length <= 40 && p.Button == "Начать · 2 минуты");
    }

    [Test]
    public void After_a_week_away_the_push_says_hello_and_promises_a_minute()
    {
        var push = DailyTaskPlanner.Compose(new DailyInput { Now = Now, Away = 9, Forms = Verb("a", 3) }).Push!;

        push.Variant.ShouldBe("comeback");
        push.Button.ShouldBe("Вспомнить за минуту");
    }

    [Test]
    public void Nothing_to_play_means_no_task()
    {
        DailyTaskPlanner.Compose(new DailyInput { Now = Now }).Available.ShouldBeFalse();
    }

    [Test]
    public void The_same_day_gives_the_same_task()
    {
        var input = new DailyInput { Now = Now, Accuracy = 90, Forms = Verb("a", 2).Concat(Verb("b", 3)).ToList(), Seed = 42 };

        System.Text.Json.JsonSerializer.Serialize(DailyTaskPlanner.Compose(input))
            .ShouldBe(System.Text.Json.JsonSerializer.Serialize(DailyTaskPlanner.Compose(input)));
    }

    [TestCase(null, 0, 87)]
    [TestCase(90, 3, 78)]
    [TestCase(45, 9, 43)]
    [TestCase(100, 0, 100)]
    public void Accuracy_follows_recent_games(int? accuracy, int errors, int expected)
    {
        DailyTaskPlanner.NextAccuracy(accuracy, errors).ShouldBe(expected);
    }
}

public class CoursePlannerTests
{
    private static CourseModule Module(string id, int lessons) =>
        new(id, id + "-title", Enumerable.Range(1, lessons).Select(i => new CourseLesson(i, $"L{i}")).ToList());

    private static readonly List<CourseModule> Catalog =
    [
        Module("alphabet-progressive", 31), Module("numbers", 11), Module("my-day", 30), Module("cases", 10),
        Module("pronouns", 6), Module("intro", 33)
    ];

    private static Dictionary<string, IReadOnlyCollection<int>> Done(params (string Id, int[] Lessons)[] modules) =>
        modules.ToDictionary(m => m.Id, m => (IReadOnlyCollection<int>)m.Lessons);

    private static readonly Dictionary<string, IReadOnlyCollection<int>> Owner = Done(
        ("alphabet-progressive", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14]),
        ("numbers", Enumerable.Range(1, 11).ToArray()),
        ("pronouns", Enumerable.Range(1, 6).ToArray()),
        ("cases", Enumerable.Range(1, 7).ToArray()),
        ("intro", [1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 33]));

    [Test]
    public void An_almost_finished_module_is_finished_first()
    {
        var next = CoursePlanner.Next(Catalog, Owner, new Dictionary<string, string>())!;

        next.Kind.ShouldBe(DailyNew.Lesson);
        next.ModuleId.ShouldBe("cases");
        next.LessonId.ShouldBe(8);
        next.Say.ShouldContain("пройдено 7 из 10");
    }

    [Test]
    public void A_module_with_its_last_lesson_passed_gets_a_one_minute_check()
    {
        var done = new Dictionary<string, IReadOnlyCollection<int>>(Owner) { ["cases"] = Enumerable.Range(1, 10).ToArray() };

        var next = CoursePlanner.Next(Catalog, done, new Dictionary<string, string>())!;

        next.Kind.ShouldBe(DailyNew.Check);
        next.ModuleId.ShouldBe("intro");
        next.CheckLessons!.Count.ShouldBe(6);
        next.CheckLessons.ShouldAllBe(id => id >= 9 && id <= 32);
    }

    [Test]
    public void A_passed_check_closes_the_module_and_the_alphabet_reading_lessons_are_not_offered_to_a_reader()
    {
        var done = new Dictionary<string, IReadOnlyCollection<int>>(Owner) { ["cases"] = Enumerable.Range(1, 10).ToArray() };

        var next = CoursePlanner.Next(Catalog, done, new Dictionary<string, string> { ["intro"] = CoursePlanner.Known })!;

        next.ModuleId.ShouldBe("my-day");
        next.LessonId.ShouldBe(1);
    }

    [Test]
    public void A_failed_check_brings_the_skipped_lessons_back_one_by_one()
    {
        var done = new Dictionary<string, IReadOnlyCollection<int>>(Owner) { ["cases"] = Enumerable.Range(1, 10).ToArray() };

        var next = CoursePlanner.Next(Catalog, done, new Dictionary<string, string> { ["intro"] = CoursePlanner.Lessons })!;

        next.Kind.ShouldBe(DailyNew.Lesson);
        next.ModuleId.ShouldBe("intro");
        next.LessonId.ShouldBe(9);
        next.Say.ShouldContain("осталось 22");
    }

    [Test]
    public void A_beginner_goes_through_the_alphabet()
    {
        var next = CoursePlanner.Next(Catalog, Done(("alphabet-progressive", [1])), new Dictionary<string, string>())!;

        next.ModuleId.ShouldBe("alphabet-progressive");
        next.LessonId.ShouldBe(2);
    }
}
