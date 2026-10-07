using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;

namespace IntegrationTests.MiniApp;

/// <summary>
/// The «Глаголы» section over HTTP, as the mini-app calls it, against real Postgres: the ladder
/// with the learner's progress, what the "what now" card picks in its main states, "my verbs"
/// including a model-made one, the overview a person without access gets, and how a visit by a
/// link is recorded. Georgian strings come from the catalog; none is written here.
/// </summary>
public class VerbSectionTests : TestBase
{
    private static readonly VerbLevelCatalog Ladder =
        VerbLevelCatalog.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "levels.json")));

    private TraleTestApplication _app = null!;
    private User _user = null!;

    [OneTimeSetUp]
    public async Task StartSignedAppAndSeed()
    {
        _app = _testServer.WithSignedLogin(ownerTelegramId: 1);
        await InScope(async sp =>
        {
            var catalog = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json"));
            return await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(catalog, CancellationToken.None);
        });
    }

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    [SetUp]
    public async Task NewLearner() => _user = await AddUser(registeredDaysAgo: 1);

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    private Task<User> AddUser(int registeredDaysAgo) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var user = Create.User(Random.Shared.NextInt64(1_000_000, 900_000_000_000), "Learner");
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-registeredDaysAgo);
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
        await db.SaveChangesAsync(CancellationToken.None);
        return await db.Users.Include(u => u.Settings).SingleAsync(u => u.Id == user.Id);
    });

    private async Task<JsonNode> Section(User? user = null)
    {
        using var client = _app.ClientFor((user ?? _user).TelegramId);
        var response = await client.GetAsync("/api/miniapp/verbs/section");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
    }

    /// <summary>A played session: the given forms at the given step; <paramref name="examPassed"/> makes the verb learned.</summary>
    private Task<int> Play(string lemma, DateTime at, bool examPassed = false, int step = 3, DateTime? dueAt = null) => InScope(async sp =>
    {
        var forms = new[] { new VerbFormStep("present", 0, step, 0, at), new VerbFormStep("present", 1, step, 0, at) };
        var report = new VerbSessionReport(Guid.NewGuid(), """{"scenes":[]}""", 0, 0, forms, true, new[] { "meet" }, false, examPassed ? 6 : 0, examPassed ? 6 : 0);
        await sp.GetRequiredService<VerbLearningService>().SaveAsync(_user, lemma, report, 11, at, CancellationToken.None);
        if (dueAt != null)
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var rows = await db.VerbFormProgresses.Where(p => p.UserId == _user.Id && p.Verb.Lemma == lemma).ToListAsync();
            rows.ForEach(r => r.NextDueAtUtc = dueAt);
            await db.SaveChangesAsync(CancellationToken.None);
        }
        return 0;
    });

    private Task<int> Save(string word, string definition) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        db.VocabularyEntries.Add(new VocabularyEntry
        {
            Id = Guid.NewGuid(), Word = word, Definition = definition, AdditionalInfo = "", Example = "",
            DateAddedUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow, UserId = _user.Id, Language = Language.Georgian
        });
        return await db.SaveChangesAsync(CancellationToken.None);
    });

    private static string FirstInLadder => Ladder.Lemmas[0];
    private static string SecondInLadder => Ladder.Lemmas[1];

    private Task<string> FormOf(string lemma) => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().VerbForms.Where(f => f.Verb.Lemma == lemma && f.Tense == "present" && f.Person == 0)
            .Select(f => f.Form).FirstAsync());

    [Test]
    public async Task Newcomer_gets_the_whole_ladder_and_the_first_verb_to_play()
    {
        var section = await Section();

        section["hasAccess"]!.GetValue<bool>().Should().BeTrue();
        section["total"]!.GetValue<int>().Should().Be(Ladder.Lemmas.Count);
        section["learned"]!.GetValue<int>().Should().Be(0);
        section["currentLevel"]!.GetValue<int>().Should().Be(1);
        section["levels"]!.AsArray().Select(l => l!["title"]!.GetValue<string>())
            .Should().Equal(Ladder.Levels.Select(l => l.Title));
        section["levels"]![0]!["packs"]![0]!["verbs"]!.AsArray().Select(v => v!["id"]!.GetValue<string>())
            .Should().Equal(Ladder.Levels[0].Packs[0].Verbs);
        section["next"].Should().BeEquivalentToJson(new
        {
            kind = "new", id = FirstInLadder, level = "new", due = 0, levelId = 1, packId = Ladder.Levels[0].Packs[0].Id
        });
        section["next"]!["title"]!.GetValue<string>().Should().NotBeEmpty();
        section["next"]!["packTitle"]!.GetValue<string>().Should().Be(Ladder.Levels[0].Packs[0].Title);
        section["myVerbs"]!.AsArray().Should().BeEmpty();
        section["examples"]!.AsArray().Should().HaveCount(VerbSectionQuery.ExampleCount)
            .And.OnlyContain(e => e!.GetValue<string>().All(char.IsLetter), "an example is one Russian word a person can tap");
        section["alphabetHint"]!.GetValue<bool>().Should().BeTrue("a newcomer has not finished the alphabet");
    }

    [Test]
    public async Task Verb_in_progress_is_what_to_do_now_and_shows_as_started_in_its_pack()
    {
        var later = Ladder.Levels[1].Packs[0].Verbs[0];
        await Play(FirstInLadder, DateTime.UtcNow.AddHours(-3));
        await Play(later, DateTime.UtcNow.AddMinutes(-5));

        var section = await Section();

        section["next"].Should().BeEquivalentToJson(new { kind = "continue", id = later, level = "recognising", levelId = 2 });
        section["currentLevel"]!.GetValue<int>().Should().Be(2, "the level of the verb in progress is the one shown open");
        section["levels"]![0]!["packs"]![0]!["verbs"]![0]!["level"]!.GetValue<string>().Should().Be("recognising");
        section["myVerbs"]!.AsArray().Select(v => v!["id"]!.GetValue<string>()).Should().Equal(later, FirstInLadder);
        section["myVerbs"]![0]!["packId"]!.GetValue<string>().Should().Be(Ladder.Levels[1].Packs[0].Id, "listed here and counted in its level — one verb, not two");
    }

    [Test]
    public async Task Learned_verb_with_forms_due_is_offered_for_review_before_a_new_one()
    {
        await Play(FirstInLadder, DateTime.UtcNow.AddDays(-2), examPassed: true, step: 6, dueAt: DateTime.UtcNow.AddHours(-1));

        var section = await Section();

        section["learned"]!.GetValue<int>().Should().Be(1);
        section["next"].Should().BeEquivalentToJson(new { kind = "review", id = FirstInLadder, level = "learned", due = 2 });
    }

    [Test]
    public async Task With_nothing_in_progress_and_nothing_due_the_next_untouched_verb_of_the_ladder_is_offered()
    {
        await Play(FirstInLadder, DateTime.UtcNow.AddDays(-2), examPassed: true, step: 6, dueAt: DateTime.UtcNow.AddDays(2));

        var section = await Section();

        section["next"].Should().BeEquivalentToJson(new { kind = "new", id = SecondInLadder, level = "new" });
        section["levels"]![0]!["packs"]![0]!["verbs"]![0]!["level"]!.GetValue<string>().Should().Be("learned");
    }

    [Test]
    public async Task My_verbs_are_dictionary_verbs_and_started_verbs_and_a_model_made_one_is_marked()
    {
        var third = Ladder.Lemmas[2];
        var form = await FormOf(third);
        // A model-made verb outside the ladder; its "word" is made of a catalog form, never typed here.
        var madeUp = form + form;
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var verb = new Verb
            {
                Id = Guid.NewGuid(), Lemma = madeUp, Title = madeUp, Translation = "придуманный", Kind = "pattern", PresentJson = "[]",
                CardJson = "{}", ContentHash = "test", Status = VerbStatus.Generated, SortOrder = 100_000,
                CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow
            };
            verb.Forms.Add(new VerbForm { Id = Guid.NewGuid(), Form = madeUp, Tense = "present", Person = 2 });
            db.Verbs.Add(verb);
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        await Save("слово из каталога", form);
        await Save("придуманный", madeUp);
        await Save("стол", "не глагол");

        var section = await Section();

        var mine = section["myVerbs"]!.AsArray();
        mine.Select(v => v!["id"]!.GetValue<string>()).Should().BeEquivalentTo(new[] { third, madeUp });
        mine.Single(v => v!["id"]!.GetValue<string>() == madeUp).Should().BeEquivalentToJson(new { generated = true, level = "new", ru = "придуманный" });
        mine.Single(v => v!["id"]!.GetValue<string>() == madeUp)!["levelId"].Should().BeNull();
        mine.Single(v => v!["id"]!.GetValue<string>() == third).Should().BeEquivalentToJson(new { generated = false, levelId = 1 });
        section["next"]!["id"]!.GetValue<string>().Should().Be(FirstInLadder, "a saved word alone does not start a verb");

        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.Where(v => v.Lemma == madeUp).ToListAsync());
            return await db.SaveChangesAsync(CancellationToken.None);
        });
    }

    [Test]
    public async Task Without_access_the_section_is_an_overview_without_georgian_and_a_verb_itself_stays_closed()
    {
        _user = await AddUser(registeredDaysAgo: 200);
        var word = await FormOf(FirstInLadder);
        await Save("моё слово", word);

        var section = await Section();
        using var client = _app.ClientFor(_user.TelegramId);
        var card = await client.GetAsync($"/api/miniapp/verbs/{Uri.EscapeDataString(FirstInLadder)}");
        var learning = await client.GetAsync($"/api/miniapp/verbs/{Uri.EscapeDataString(FirstInLadder)}/learning");

        section["hasAccess"]!.GetValue<bool>().Should().BeFalse();
        section["total"]!.GetValue<int>().Should().Be(Ladder.Lemmas.Count);
        section["levels"]!.AsArray().Should().HaveCount(5);
        section["next"]!["ru"]!.GetValue<string>().Should().NotBeEmpty();
        section["next"]!["packTitle"]!.GetValue<string>().Should().NotBeEmpty();
        section["myVerbs"]!.AsArray().Should().HaveCount(1);
        section.ToJsonString(new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping })
            .Should().NotMatchRegex("[ა-ჰ]", "nothing Georgian — no form, no verb id — is given away without access");
        card.StatusCode.Should().Be(HttpStatusCode.PaymentRequired);
        learning.StatusCode.Should().Be(HttpStatusCode.PaymentRequired);
    }

    [Test]
    public async Task Section_needs_a_signed_in_caller()
    {
        using var anonymous = _app.CreateClient();

        (await anonymous.GetAsync("/api/miniapp/verbs/section")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anonymous.PostAsJsonAsync("/api/miniapp/verbs/section/open", new { source = "home" })).StatusCode
            .Should().Be(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task Section_stays_a_fixed_handful_of_queries_whatever_the_progress()
    {
        foreach (var lemma in Ladder.Lemmas.Take(12))
        {
            await Play(lemma, DateTime.UtcNow.AddMinutes(-30));
        }

        var counter = new QueryCounter();
        var section = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<TraleDbContext>();
            using var listener = System.Diagnostics.DiagnosticListener.AllListeners.Subscribe(counter);
            var user = await db.Users.Include(u => u.Settings).SingleAsync(u => u.Id == _user.Id);
            counter.Reset();
            return await sp.GetRequiredService<VerbSectionQuery>().GetAsync(user, 11, DateTime.UtcNow, CancellationToken.None);
        });

        section.MyVerbs.Should().HaveCount(12);
        counter.Count.Should().BeInRange(1, 7, "the section is one cheap call: no query per verb");
    }

    // ── Where people came from ───────────────────────────────────────────────

    private async Task<HttpStatusCode> Open(string? source, User? user = null)
    {
        using var client = _app.ClientFor((user ?? _user).TelegramId);
        return (await client.PostAsJsonAsync("/api/miniapp/verbs/section/open", new { source })).StatusCode;
    }

    private Task<List<VerbSectionVisit>> Visits() => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().VerbSectionVisits.AsNoTracking().Where(v => v.UserId == _user.Id).ToListAsync());

    [Test]
    public async Task Opening_by_a_tagged_link_is_recorded_once_per_source_even_for_a_person_who_has_a_first_source()
    {
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            (await db.Users.SingleAsync(u => u.Id == _user.Id)).AcquisitionSource = "site";
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        (await Open("Verbs_Oct")).Should().Be(HttpStatusCode.OK);
        (await Open("verbs_oct")).Should().Be(HttpStatusCode.OK);
        (await Open(VerbSectionVisit.Home)).Should().Be(HttpStatusCode.OK);

        var visits = await Visits();
        visits.Select(v => v.Source).Should().BeEquivalentTo(new[] { "verbs_oct", "home" });
        visits.Single(v => v.Source == "verbs_oct").Should().BeEquivalentTo(new { Opens = 2 });
        visits.Single(v => v.Source == "verbs_oct").LastOpenedAtUtc.Should().BeOnOrAfter(visits.Single(v => v.Source == "verbs_oct").FirstOpenedAtUtc);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.Where(u => u.Id == _user.Id).Select(u => u.AcquisitionSource).SingleAsync()))
            .Should().Be("site", "the first-touch source is never rewritten");
    }

    [Test]
    public async Task A_tag_that_is_not_a_tag_is_refused_and_nothing_is_recorded()
    {
        (await Open("с пробелом и кириллицей")).Should().Be(HttpStatusCode.BadRequest);
        (await Open(null)).Should().Be(HttpStatusCode.BadRequest);
        (await Open(new string('a', 65))).Should().Be(HttpStatusCode.BadRequest);

        (await Visits()).Should().BeEmpty();
    }

    [Test]
    public async Task A_person_without_access_is_recorded_too()
    {
        _user = await AddUser(registeredDaysAgo: 200);

        (await Open("verbs-2026-10")).Should().Be(HttpStatusCode.OK);

        (await Visits()).Should().ContainSingle().Which.Source.Should().Be("verbs-2026-10");
    }

    [Test]
    public async Task The_report_query_counts_who_came_played_finished_and_came_back()
    {
        const string tag = "verbs_report";
        var cameAndLeft = _user;
        (await Open(tag)).Should().Be(HttpStatusCode.OK);

        _user = await AddUser(1);
        var finishedAndReturned = _user;
        await Open(tag);
        await Play(FirstInLadder, DateTime.UtcNow.AddMinutes(1));
        await Play(FirstInLadder, DateTime.UtcNow.AddDays(1).AddMinutes(1));

        _user = await AddUser(1);
        await Open(tag);
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var verbId = await db.Verbs.Where(v => v.Lemma == FirstInLadder).Select(v => v.Id).SingleAsync();
            db.VerbSessions.Add(new VerbSession
            {
                Id = Guid.NewGuid(), UserId = _user.Id, VerbId = verbId, PlanJson = "{}",
                StartedAtUtc = DateTime.UtcNow.AddMinutes(2), UpdatedAtUtc = DateTime.UtcNow.AddMinutes(2)
            });
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        _user = await AddUser(1);
        await Open("another_tag");
        await Play(FirstInLadder, DateTime.UtcNow.AddMinutes(1));

        var sql = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Sql", "verbs-section-report.sql")).Replace(":'source'", $"'{tag}'");
        var row = await InScope(async sp =>
        {
            await using var connection = new Npgsql.NpgsqlConnection(sp.GetRequiredService<TraleDbContext>().Database.GetConnectionString());
            await connection.OpenAsync();
            await using var command = new Npgsql.NpgsqlCommand(sql, connection);
            await using var reader = await command.ExecuteReaderAsync();
            (await reader.ReadAsync()).Should().BeTrue();
            return Enumerable.Range(0, reader.FieldCount).ToDictionary(reader.GetName, i => Convert.ToInt64(reader.GetValue(i)));
        });

        row.Should().BeEquivalentTo(new Dictionary<string, long>
        {
            ["came"] = 3, ["without_access"] = 0, ["started_session"] = 2, ["finished_session"] = 1,
            ["came_back_another_day"] = 1, ["opened_from_home_later"] = 0, ["paid_after"] = 0
        });
        cameAndLeft.Should().NotBeNull();
        finishedAndReturned.Should().NotBeNull();
    }

    [Test]
    public async Task Start_link_with_the_verbs_tag_gives_a_button_that_opens_the_section_with_that_tag()
    {
        var telegram = (IntegrationTests.Fakes.TelegramClientFake)_app.Services.GetRequiredService<Telegram.Bot.ITelegramBotClient>();
        var mark = telegram.Requests.Count;
        using var client = _app.CreateClient();

        var response = await client.PostAsync("/telegram/test_token",
            IntegrationTests.Extensions.JsonExtensions.ToJsonContent(Create.TelegramUpdate(Random.Shared.Next(1, int.MaxValue), _user.TelegramId, "/start verbs_Oct")));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var urls = telegram.Requests.Skip(mark).OfType<Telegram.Bot.Requests.SendMessageRequest>()
            .Select(r => r.ReplyMarkup).OfType<Telegram.Bot.Types.ReplyMarkups.InlineKeyboardMarkup>()
            .SelectMany(k => k.InlineKeyboard.SelectMany(row => row)).Where(b => b.WebApp != null).Select(b => b.WebApp!.Url).ToList();
        urls.Should().ContainSingle().Which.Should().Be($"{SignedMiniApp.Host}/?screen=verbs&src=verbs_oct");
    }

    [TestCase("verbs", true)]
    [TestCase("verbs_oct-2026", true)]
    [TestCase("VERBS_x", true)]
    [TestCase("verbsx", false)]
    [TestCase("site", false)]
    [TestCase("ref_123", false)]
    [TestCase(null, false)]
    public void Only_the_verbs_payload_leads_to_the_section(string? payload, bool expected) =>
        Infrastructure.Telegram.BotCommands.StartCommand.IsVerbsSectionPayload(payload).Should().Be(expected);

    private sealed class QueryCounter : IObserver<System.Diagnostics.DiagnosticListener>, IObserver<KeyValuePair<string, object?>>
    {
        private int _count;
        public int Count => _count;
        public void Reset() => _count = 0;
        public void OnNext(System.Diagnostics.DiagnosticListener listener)
        {
            if (listener.Name == DbLoggerCategory.Name) listener.Subscribe(this);
        }
        public void OnNext(KeyValuePair<string, object?> e)
        {
            if (e.Key == Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.CommandExecuted.Name) Interlocked.Increment(ref _count);
        }
        public void OnCompleted() { }
        public void OnError(Exception error) { }
    }
}

internal static class JsonNodeAssertions
{
    /// <summary>Every property of <paramref name="expected"/> is in the node with the same value; other properties are ignored.</summary>
    public static void BeEquivalentToJson(this FluentAssertions.Primitives.ObjectAssertions assertions, object expected)
    {
        var node = (JsonNode)assertions.Subject;
        node.Should().NotBeNull();
        foreach (var (name, value) in JsonSerializer.SerializeToNode(expected)!.AsObject())
        {
            node![name]?.ToJsonString().Should().Be(value?.ToJsonString(), $"property «{name}»");
        }
    }
}
