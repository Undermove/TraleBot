using Application.Common;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.MiniApp;

/// <summary>
/// The verb as the learner's own thing: level derived from form progress and the exam, the session
/// in progress stored on the server, and a finished session credited once — against real Postgres.
/// </summary>
public class VerbLearningTests : TestBase
{
    private const string Write = "წერს";
    private const int AlphabetLessons = 11;
    private static readonly DateTime Now = new(2026, 10, 5, 18, 0, 0, DateTimeKind.Utc);
    private const string Plan = """{"scenes":[{"type":"meet","units":6},{"type":"time","units":4}]}""";

    private Guid _userId;

    private static string CatalogJson() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json"));

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        using var scope = _testServer.Services.CreateScope();
        return await action(scope.ServiceProvider);
    }

    private static VerbSessionReport Report(
        Guid id, int scene = 0, int done = 0, bool finished = false, string? plan = Plan, bool story = false,
        int examAsked = 0, int examCorrect = 0, params VerbFormStep[] forms) =>
        new(id, plan, scene, done, forms, finished, new[] { "meet", "time" }, story, examAsked, examCorrect);

    private Task<VerbSessionOutcome?> Save(VerbSessionReport report, DateTime? now = null, string lemma = Write) =>
        InScope(async sp =>
        {
            var user = await sp.GetRequiredService<ITraleDbContext>().Users.Include(u => u.Settings).SingleAsync(u => u.Id == _userId);
            return await sp.GetRequiredService<VerbLearningService>()
                .SaveAsync(user, lemma, report, AlphabetLessons, now ?? Now, CancellationToken.None);
        });

    private Task<VerbLearningState?> Get(DateTime? now = null, string lemma = Write) =>
        InScope(async sp =>
        {
            var user = await sp.GetRequiredService<ITraleDbContext>().Users.Include(u => u.Settings).SingleAsync(u => u.Id == _userId);
            return await sp.GetRequiredService<VerbLearningService>()
                .GetAsync(user, lemma, AlphabetLessons, now ?? Now, CancellationToken.None);
        });

    private Task<MiniAppUserProgress?> MiniAppProgress() =>
        InScope(sp => sp.GetRequiredService<ITraleDbContext>().MiniAppUserProgresses.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == _userId));

    /// <summary>The first <paramref name="count"/> main forms at the given step.</summary>
    private static VerbFormStep[] Forms(int count, int step)
    {
        var tenses = new[] { "present", "aorist", "imperfect", "optative", "conditional", "future" };
        return Enumerable.Range(0, count).Select(i => new VerbFormStep(tenses[i / 6], i % 6, step, 0, Now)).ToArray();
    }

    [SetUp]
    public async Task SeedCatalogAndUser()
    {
        _userId = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.ToListAsync());
            await db.SaveChangesAsync(CancellationToken.None);
            await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None);

            var user = Create.User(Random.Shared.NextInt64(1, long.MaxValue), "Learner");
            db.Users.Add(user);
            await db.SaveChangesAsync(CancellationToken.None);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
            await db.SaveChangesAsync(CancellationToken.None);
            return user.Id;
        });
    }

    // ── Level rules (pure) ───────────────────────────────────────────────────

    /// <summary>
    /// The same cases drive the mini-app's session simulation (session/plan.test.ts), which carries a
    /// test-only copy of the rule — this fixture is what keeps the two from drifting apart.
    /// </summary>
    [Test]
    public void Level_follows_from_solid_forms_and_the_exam()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "verb-level-cases.json");
        var cases = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path)).RootElement.GetProperty("cases").EnumerateArray().ToList();
        cases.Should().NotBeEmpty();

        foreach (var c in cases)
        {
            var steps = Enumerable.Repeat(c.GetProperty("bestStep").GetInt32(), c.GetProperty("started").GetInt32()).ToList();
            var level = VerbLevelRules.Derive(c.GetProperty("cells").GetInt32(), steps, c.GetProperty("exam").GetBoolean());
            VerbLevelRules.Key(level).Should().Be(c.GetProperty("level").GetString(), because: c.GetRawText());
        }
    }

    [TestCase(36, 8, 8, true)]
    [TestCase(36, 8, 7, true, Description = "one mistake is forgiven")]
    [TestCase(36, 8, 6, false)]
    [TestCase(36, 3, 3, false, Description = "too short to be an exam")]
    [TestCase(4, 4, 4, true, Description = "a verb with four forms is examined on all four")]
    [TestCase(36, 8, 9, false, Description = "more right answers than questions is not a report")]
    public void Exam_is_passed_with_at_most_one_mistake(int cells, int asked, int correct, bool passed)
    {
        VerbLevelRules.ExamPassed(cells, asked, correct).Should().Be(passed);
    }

    // ── State ────────────────────────────────────────────────────────────────

    [Test]
    public async Task Untouched_verb_is_new_with_no_session_and_a_beginner_does_not_type()
    {
        var state = await Get();

        state!.Level.Should().Be(VerbLevel.New);
        state.Session.Should().BeNull();
        state.Memory.Should().BeEquivalentTo(new VerbMemory(0, new List<string>(), false, false));
        state.Learner.CanType.Should().BeFalse();
        state.Progress.CanLearn.Should().BeTrue();
    }

    [Test]
    public async Task Learner_profile_reflects_alphabet_dictionary_and_learned_verbs()
    {
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.MiniAppUserProgresses.Add(new MiniAppUserProgress
            {
                Id = Guid.NewGuid(), UserId = _userId, Level = "beginner",
                CompletedLessonsJson = """{"alphabet-progressive":[1,2,3,4,5,6,7,8,9,10,11]}""",
                CreatedAtUtc = Now, UpdatedAtUtc = Now
            });
            db.VocabularyEntries.Add(new VocabularyEntry
            {
                Id = Guid.NewGuid(), UserId = _userId, Word = "ვწერ", Definition = "я пишу", AdditionalInfo = "",
                Example = "", Language = Language.Georgian, DateAddedUtc = Now, UpdatedAtUtc = Now
            });
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        var state = await Get();

        state!.Learner.Should().BeEquivalentTo(new VerbLearnerProfile("beginner", true, 1, 1, 0));
    }

    [Test]
    public async Task Form_progress_saved_before_levels_existed_still_gives_a_level()
    {
        await InScope(sp => sp.GetRequiredService<VerbProgressService>()
            .SaveAsync(_userId, Write, Forms(3, 3), Now, CancellationToken.None));

        (await Get())!.Level.Should().Be(VerbLevel.Recognising);
    }

    // ── Session in progress ──────────────────────────────────────────────────

    [Test]
    public async Task Unfinished_session_is_handed_back_with_its_plan_and_position()
    {
        var id = Guid.NewGuid();
        await Save(Report(id, forms: Forms(1, 1)));
        await Save(Report(id, scene: 1, done: 2, plan: null, forms: Forms(2, 2)));

        var state = await Get();

        state!.Session.Should().BeEquivalentTo(new ActiveVerbSession(id, Plan, 1, 2));
        state.Level.Should().Be(VerbLevel.Meeting);
        state.Memory.SessionsPlayed.Should().Be(0);
        (await MiniAppProgress()).Should().BeNull("an unfinished session earns nothing");
    }

    [Test]
    public async Task Late_report_does_not_move_the_session_back()
    {
        var id = Guid.NewGuid();
        await Save(Report(id, scene: 1, done: 3));
        await Save(Report(id, scene: 0, done: 5));
        await Save(Report(id, scene: 1, done: 1));

        (await Get())!.Session.Should().BeEquivalentTo(new ActiveVerbSession(id, Plan, 1, 3));
    }

    [Test]
    public async Task Session_abandoned_long_ago_is_not_resumed()
    {
        await Save(Report(Guid.NewGuid(), scene: 1, done: 1));

        (await Get(Now + VerbLearningService.ResumeWindow + TimeSpan.FromMinutes(1)))!.Session.Should().BeNull();
    }

    [Test]
    public async Task First_report_without_a_plan_and_someone_elses_session_are_refused()
    {
        (await Save(Report(Guid.NewGuid(), plan: null))).Should().BeNull();

        var id = Guid.NewGuid();
        await Save(Report(id));
        (await Save(Report(id), lemma: "მიდის")).Should().BeNull("a session belongs to one verb");
        (await Save(Report(Guid.NewGuid()), lemma: "нет-такого")).Should().BeNull();
    }

    // ── Finishing ────────────────────────────────────────────────────────────

    [Test]
    public async Task Finished_session_is_credited_once_however_often_it_is_reported()
    {
        var id = Guid.NewGuid();
        var first = await Save(Report(id, scene: 2, finished: true, forms: Forms(3, 3)));
        var replay = await Save(Report(id, scene: 2, finished: true, forms: Forms(3, 3)));

        first!.XpEarned.Should().Be(LearningConstants.XpRewards.VerbSession);
        first.Progress.Should().NotBeNull();
        replay!.XpEarned.Should().Be(0);
        replay.State.Session.Should().BeNull();
        replay.State.Memory.SessionsPlayed.Should().Be(1);
        replay.State.Memory.RecentScenes.Should().Equal("meet+time");
        replay.State.Level.Should().Be(VerbLevel.Recognising);

        var miniApp = await MiniAppProgress();
        miniApp!.Xp.Should().Be(LearningConstants.XpRewards.VerbSession);
        miniApp.Streak.Should().Be(1);
        miniApp.LastPlayedAtUtc.Should().NotBeNull();
        miniApp.ActivityDaysJson.Should().NotBeNullOrEmpty("a finished session marks the day active like a lesson does");
    }

    [Test]
    public async Task Xp_stops_at_the_daily_cap_but_sessions_still_count()
    {
        var cap = LearningConstants.XpRewards.VerbSessionsPerDay;
        for (var i = 0; i < cap + 2; i++)
        {
            await Save(Report(Guid.NewGuid(), finished: true), Now.AddMinutes(i));
        }

        (await MiniAppProgress())!.Xp.Should().Be(cap * LearningConstants.XpRewards.VerbSession);
        (await Get())!.Memory.SessionsPlayed.Should().Be(cap + 2);

        var nextDay = await Save(Report(Guid.NewGuid(), finished: true), Now.AddDays(1));
        nextDay!.XpEarned.Should().Be(LearningConstants.XpRewards.VerbSession);
    }

    [Test]
    public async Task Director_memory_keeps_only_recent_scenes_and_the_story_flag()
    {
        for (var i = 0; i < UserVerb.RecentSessionsKept + 2; i++)
        {
            await Save(Report(Guid.NewGuid(), finished: true, story: i == 0), Now.AddMinutes(i));
        }

        var memory = (await Get())!.Memory;
        memory.RecentScenes.Should().HaveCount(UserVerb.RecentSessionsKept).And.OnlyContain(s => s == "meet+time");
        memory.StoryCompleted.Should().BeTrue();
    }

    [Test]
    public async Task Level_grows_with_solid_forms_and_never_goes_down()
    {
        (await Save(Report(Guid.NewGuid(), finished: true, forms: Forms(12, 3))))!.State.Level.Should().Be(VerbLevel.Phrases);

        // Forgotten forms drop a step; the level stays.
        var later = Now.AddDays(1);
        var dropped = Forms(12, 2).Select(f => f with { AtUtc = later }).ToArray();
        (await Save(Report(Guid.NewGuid(), finished: true, forms: dropped), later))!.State.Level.Should().Be(VerbLevel.Phrases);
    }

    [Test]
    public async Task Passing_the_exam_makes_the_verb_learned_and_failing_does_not()
    {
        await Save(Report(Guid.NewGuid(), finished: true, forms: Forms(24, 3)));
        (await Get())!.Level.Should().Be(VerbLevel.ExamReady);

        var failed = await Save(Report(Guid.NewGuid(), finished: true, examAsked: 8, examCorrect: 5), Now.AddMinutes(1));
        failed!.State.Level.Should().Be(VerbLevel.ExamReady);
        failed.State.Memory.ExamPassed.Should().BeFalse();

        var passed = await Save(Report(Guid.NewGuid(), finished: true, examAsked: 8, examCorrect: 7), Now.AddMinutes(2));
        passed!.State.Level.Should().Be(VerbLevel.Learned);
        passed.State.Memory.ExamPassed.Should().BeTrue();
        passed.State.Learner.VerbsLearned.Should().Be(1);
    }

    [Test]
    public async Task Session_endpoints_require_authentication()
    {
        var client = _testServer.CreateClient();

        (await client.GetAsync($"/api/miniapp/verbs/{Write}/learning")).StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
        var post = await client.PostAsync($"/api/miniapp/verbs/{Write}/session",
            new StringContent($$"""{"sessionId":"{{Guid.NewGuid()}}","plan":{{Plan}}}""", System.Text.Encoding.UTF8, "application/json"));
        post.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }
}
