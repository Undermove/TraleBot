using System.Net;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Verb families — one verb with different direction prefixes. First the data
/// (<c>src/Trale/Verbs/families.json</c>, built by <c>scripts/verbs/build-families.mjs</c>) against
/// the catalog it is derived from; then the behaviour over HTTP against real Postgres: the family
/// card of the section, the "learned" rule of a member, old progress, the "what now" choice and
/// the family note of a verb card. Georgian comes from the data files; none is written here.
/// </summary>
public class VerbFamilyTests : TestBase
{
    private const double MinRegular = 0.95;

    private static string Read(string file) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", file));

    private static readonly JsonNode FamiliesFile = JsonNode.Parse(Read("families.json"))!;
    private static readonly VerbFamilyCatalog Families = VerbFamilyCatalog.Parse(Read("families.json"));
    private static readonly VerbLevelCatalog Ladder = VerbLevelCatalog.Parse(Read("levels.json"));

    private static readonly Dictionary<string, JsonNode> Catalog = JsonNode.Parse(Read("verbs.json"))!["verbs"]!.AsArray()
        .ToDictionary(v => v!["lemma"]!.GetValue<string>(), v => v!);

    private static VerbFamily Go => Families.Find("go")!;
    private static string Base => Go.Base;

    /// <summary>Members that stand on the family card (not in a pack), in the card's order.</summary>
    private static IReadOnlyList<string> CardVerbs =>
        Ladder.Levels.SelectMany(l => l.Families ?? Array.Empty<VerbPack>()).Single(f => f.Id == "go").Verbs;

    /// <summary>The member of the base pair that stands in a pack — the plain "here" verb.</summary>
    private static string PackMember => Go.Members.Single(m => m.Role == VerbFamilyCatalog.Member && m.Direction == "none").Lemma;

    private TraleTestApplication _app = null!;
    private User _user = null!;

    [OneTimeSetUp]
    public async Task StartSignedAppAndSeed()
    {
        _app = _testServer.WithSignedLogin(ownerTelegramId: 1);
        await InScope(async sp => await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(Read("verbs.json"), CancellationToken.None));
    }

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    [SetUp]
    public async Task NewLearner() => _user = await InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var user = Create.User(Random.Shared.NextInt64(1_000_000, 900_000_000_000), "Learner");
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-1);
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
        await db.SaveChangesAsync(CancellationToken.None);
        return await db.Users.Include(u => u.Settings).SingleAsync(u => u.Id == user.Id);
    });

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    private async Task<JsonNode> Get(string path)
    {
        using var client = _app.ClientFor(_user.TelegramId);
        var response = await client.GetAsync("/api/miniapp/" + path);
        response.StatusCode.Should().Be(HttpStatusCode.OK, path);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
    }

    private static readonly string[] OrdinaryScenes = { "meet", "pick" };
    private static readonly string[] PrefixScenes = { "prefix", "prefixcheck" };

    /// <summary>A finished session of <paramref name="lemma"/> with the given scenes and the tally of its last scene.</summary>
    private Task<VerbSessionOutcome?> Play(string lemma, string[] scenes, int asked = 0, int correct = 0, DateTime? at = null) => InScope(async sp =>
    {
        var now = at ?? DateTime.UtcNow;
        var forms = new[] { new VerbFormStep("present", 0, 3, 0, now), new VerbFormStep("present", 2, 3, 0, now) };
        var report = new VerbSessionReport(Guid.NewGuid(), """{"v":1,"scenes":[]}""", 0, 0, forms, true, scenes, false, asked, correct);
        return await sp.GetRequiredService<VerbLearningService>().SaveAsync(_user, lemma, report, 11, now, CancellationToken.None);
    });

    private Task<VerbSessionOutcome?> LearnByExam(string lemma, DateTime? at = null) => Play(lemma, new[] { "pick", "exam" }, 6, 6, at);

    private static JsonNode FamilyCard(JsonNode section) =>
        section["levels"]!.AsArray().SelectMany(l => l!["families"]!.AsArray()).Single(f => f!["id"]!.GetValue<string>() == Go.CardId)!;

    private static JsonNode MemberOn(JsonNode card, string lemma) =>
        card["members"]!.AsArray().Single(m => m!["id"]!.GetValue<string>() == lemma)!;

    // ── Data ─────────────────────────────────────────────────────────────────

    private static IEnumerable<(string Tense, int Person, string Form)> Cells(string lemma)
    {
        foreach (var (tense, persons) in Catalog[lemma]["tenses"]!.AsObject())
        {
            for (var person = 0; person < persons!.AsArray().Count; person++)
            {
                if (persons[person]!.AsArray().Count > 0)
                {
                    yield return (tense, person, persons[person]![0]!.GetValue<string>());
                }
            }
        }
    }

    private static string Strip(string form, IEnumerable<string> prefixes) =>
        prefixes.OrderByDescending(p => p.Length).Where(form.StartsWith).Select(p => form[p.Length..]).FirstOrDefault() ?? form;

    [Test]
    public void Every_family_member_is_the_base_verb_with_a_prefix_cell_by_cell()
    {
        FamiliesFile["families"]!.AsArray().Should().NotBeEmpty();
        foreach (var family in FamiliesFile["families"]!.AsArray())
        {
            var members = family!["members"]!.AsArray();
            var baseLemma = family["base"]!.GetValue<string>();
            var basePrefixes = members.Single(m => m!["lemma"]!.GetValue<string>() == baseLemma)!["prefixes"]!.AsArray().Select(p => p!.GetValue<string>()).ToList();
            var stem = Cells(baseLemma).ToDictionary(c => (c.Tense, c.Person), c => Strip(c.Form, basePrefixes));

            members.Count(m => m!["role"]!.GetValue<string>() == VerbFamilyCatalog.Base).Should().Be(1);
            foreach (var member in members)
            {
                var lemma = member!["lemma"]!.GetValue<string>();
                Catalog.Should().ContainKey(lemma, "a family is made of catalog verbs only");
                var prefixes = member["prefixes"]!.AsArray().Select(p => p!.GetValue<string>()).ToList();
                var cells = Cells(lemma).ToList();
                var regular = cells.Count(c => prefixes.Any(p => c.Form == p + stem.GetValueOrDefault((c.Tense, c.Person))));

                cells.Select(c => (c.Tense, c.Person)).Should().BeEquivalentTo(stem.Keys, $"{lemma} has every tense of the base verb");
                member["cells"]!.GetValue<int>().Should().Be(cells.Count, $"the file's count for {lemma} is the catalog's");
                member["regular"]!.GetValue<int>().Should().Be(regular, $"the file's verification of {lemma} is reproducible from the catalog");
                (regular / (double)cells.Count).Should().BeGreaterThanOrEqualTo(MinRegular, $"{lemma} is «prefix + base form» almost everywhere");
                member["deviations"]!.AsArray().Count.Should().Be(cells.Count - regular);
            }

            // No two members share a place on the scheme of directions.
            members.Select(m => m!["direction"]!.GetValue<string>() + ":" + m["toward"]!.GetValue<string>()).Should().OnlyHaveUniqueItems();
            // A related verb is an ordinary verb: it is never also a member.
            family["related"]!.AsArray().Select(r => r!["lemma"]!.GetValue<string>())
                .Should().NotIntersectWith(members.Select(m => m!["lemma"]!.GetValue<string>()));
        }
    }

    [Test]
    public void The_go_family_has_every_direction_both_ways_and_the_habitual_verb_stays_ordinary()
    {
        Go.Members.Should().HaveCount(12);
        Go.Members.Single(m => m.Role == VerbFamilyCatalog.Base).Should().BeEquivalentTo(new { Lemma = Base, Direction = "none", Toward = "there" });
        foreach (var direction in new[] { "none", "up", "down", "in", "out", "across" })
        {
            Go.Members.Where(m => m.Direction == direction).Select(m => m.Toward).Should().BeEquivalentTo(new[] { "there", "here" }, direction);
        }

        Go.Members.Where(m => m.Direction != "none").Should().OnlyContain(m => !string.IsNullOrEmpty(m.DirectionRu));

        var related = FamiliesFile["families"]![0]!["related"]!.AsArray();
        related.Should().ContainSingle();
        Catalog[related[0]!["lemma"]!.GetValue<string>()]["ru"]!.GetValue<string>().Should().Be("ходить");
        Families.Of(related[0]!["lemma"]!.GetValue<string>()).Should().BeNull("a verb whose paradigm is incomplete is not forced into the family");
    }

    [Test]
    public void The_family_card_holds_the_members_that_stand_in_no_pack()
    {
        var inPacks = Ladder.Levels.SelectMany(l => l.Packs).SelectMany(p => p.Verbs).ToHashSet();

        CardVerbs.Should().BeEquivalentTo(Go.Members.Select(m => m.Lemma).Where(l => !inPacks.Contains(l)));
        CardVerbs.Should().HaveCount(10);
        Ladder.Levels.Single(l => l.Families?.Any() == true).Id.Should().Be(2);
        inPacks.Should().Contain(new[] { Base, PackMember }, "the base pair stays in its level-1 pack");
        Ladder.PlaceOf(CardVerbs[0]).Should().BeEquivalentTo(new { LevelId = 2, PackId = Go.CardId });
        Ladder.PlaceOf(Base)!.LevelId.Should().Be(1);
    }

    [TestCase(true, 6, 6, true)]
    [TestCase(true, 6, 5, true)]
    [TestCase(true, 6, 4, false)]
    [TestCase(true, 5, 5, false)]
    [TestCase(false, 6, 6, false)]
    public void Prefix_check_needs_the_base_learned_six_questions_and_at_most_one_mistake(bool baseLearned, int asked, int correct, bool passed)
    {
        VerbLevelRules.PrefixCheckPassed(baseLearned, asked, correct).Should().Be(passed);
    }

    // ── Section ──────────────────────────────────────────────────────────────

    [Test]
    public async Task Section_shows_the_family_as_one_card_with_every_member_and_its_state()
    {
        await LearnByExam(Base);
        await Play(CardVerbs[0], OrdinaryScenes);

        var section = await Get("verbs/section");
        var card = FamilyCard(section);

        card.Should().BeEquivalentToJson(new { id = Go.CardId, title = Go.Title, baseName = Go.BaseName, baseLearned = true });
        card["members"]!.AsArray().Select(m => m!["id"]!.GetValue<string>()).Should().BeEquivalentTo(Go.Members.Select(m => m.Lemma));
        MemberOn(card, Base).Should().BeEquivalentToJson(new { level = "learned", role = "base", direction = "none", toward = "there", inCard = false });
        MemberOn(card, PackMember).Should().BeEquivalentToJson(new { level = "new", role = "member", toward = "here", inCard = false });
        MemberOn(card, CardVerbs[0]).Should().BeEquivalentToJson(new { level = "recognising", role = "member", inCard = true });
        MemberOn(card, CardVerbs[1]).Should().BeEquivalentToJson(new { level = "new", inCard = true });
        MemberOn(card, CardVerbs[0])["directionRu"]!.GetValue<string>().Should().NotBeEmpty();

        // Every member still counts as a verb of its own, once.
        section["total"]!.GetValue<int>().Should().Be(Catalog.Count);
        section["learned"]!.GetValue<int>().Should().Be(1);
        var level2 = section["levels"]!.AsArray().Single(l => l!["id"]!.GetValue<int>() == 2)!;
        level2["packs"]!.AsArray().SelectMany(p => p!["verbs"]!.AsArray()).Select(v => v!["id"]!.GetValue<string>())
            .Should().NotIntersectWith(CardVerbs, "a member on the family card is not in a pack as well");
    }

    [Test]
    public async Task Without_access_the_family_card_carries_no_georgian()
    {
        _user = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var user = await db.Users.Include(u => u.Settings).SingleAsync(u => u.Id == _user.Id);
            user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-400);
            await db.SaveChangesAsync(CancellationToken.None);
            return user;
        });

        var section = await Get("verbs/section");

        section["hasAccess"]!.GetValue<bool>().Should().BeFalse();
        var members = FamilyCard2(section)["members"]!.AsArray();
        members.Should().HaveCount(Go.Members.Count);
        members.Should().OnlyContain(m => m!["id"] == null && m["title"] == null);
        section.ToJsonString(new System.Text.Json.JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping })
            .Any(c => c is >= 'ა' and <= 'ჰ').Should().BeFalse("the overview shows no Georgian");

        using var client = _app.ClientFor(_user.TelegramId);
        (await client.GetAsync("/api/miniapp/verbs/families/go")).StatusCode.Should().Be(HttpStatusCode.PaymentRequired);
    }

    /// <summary>The family card when verb ids are hidden (no access): found by position, not by id.</summary>
    private static JsonNode FamilyCard2(JsonNode section) =>
        section["levels"]!.AsArray().SelectMany(l => l!["families"]!.AsArray()).Single()!;

    // ── What to do now ───────────────────────────────────────────────────────

    [Test]
    public async Task What_now_offers_the_base_verb_instead_of_a_member_while_the_base_is_not_learned()
    {
        // The learner opened a direction from the dictionary and played it, never having met the base verb.
        await Play(CardVerbs[2], OrdinaryScenes);

        var next = (await Get("verbs/section"))["next"]!;

        next.Should().BeEquivalentToJson(new { kind = "new", id = Base, level = "new", levelId = 1 });
        next["familyBase"].Should().BeNull("the base verb is learned in full");
    }

    [Test]
    public async Task What_now_offers_a_member_as_the_short_prefix_session_once_the_base_is_learned()
    {
        // Everything the ladder leads through before the base verb's pair is learned, the base verb among it.
        foreach (var lemma in Ladder.Lemmas.TakeWhile(l => l != PackMember))
        {
            await LearnByExam(lemma, DateTime.UtcNow.AddHours(-2));
        }

        var fresh = (await Get("verbs/section"))["next"]!;
        fresh.Should().BeEquivalentToJson(new { kind = "new", id = PackMember, familyBase = Go.BaseName });

        await Play(CardVerbs[0], PrefixScenes, asked: 6, correct: 3);
        var inProgress = (await Get("verbs/section"))["next"]!;
        inProgress.Should().BeEquivalentToJson(new
        {
            kind = "continue", id = CardVerbs[0], familyBase = Go.BaseName, levelId = 2, packId = Go.CardId, packTitle = Go.Title
        });
    }

    [Test]
    public async Task What_now_never_starts_a_full_ladder_for_a_member_through_the_whole_family()
    {
        await LearnByExam(Base, DateTime.UtcNow.AddHours(-3));
        foreach (var lemma in Go.Members.Where(m => m.Role == VerbFamilyCatalog.Member).Select(m => m.Lemma))
        {
            var next = (await Get("verbs/section"))["next"]!;
            if (Families.BaseOf(next["id"]!.GetValue<string>()) != null)
            {
                next["familyBase"]!.GetValue<string>().Should().Be(Go.BaseName, "a member is offered only as a prefix session");
            }

            (await Play(lemma, PrefixScenes, asked: 6, correct: 6))!.State.Level.Should().Be(VerbLevel.Learned);
        }

        (await Get("verbs/section"))["learned"]!.GetValue<int>().Should().Be(Go.Members.Count);
    }

    // ── The "learned" rule ───────────────────────────────────────────────────

    [Test]
    public async Task Member_is_learned_by_the_prefix_check_when_the_base_is_learned()
    {
        await LearnByExam(Base);

        var failed = await Play(CardVerbs[0], PrefixScenes, asked: 6, correct: 4);
        failed!.State.Level.Should().NotBe(VerbLevel.Learned, "two mistakes are one too many");
        failed.State.Memory.ExamPassed.Should().BeFalse();

        var passed = await Play(CardVerbs[0], PrefixScenes, asked: 6, correct: 5);
        passed!.State.Level.Should().Be(VerbLevel.Learned);
        passed.State.Memory.ExamPassed.Should().BeTrue();
        MemberOn(FamilyCard(await Get("verbs/section")), CardVerbs[0])["level"]!.GetValue<string>().Should().Be("learned");
    }

    [Test]
    public async Task Prefix_check_does_not_count_while_the_base_is_not_learned_or_for_a_verb_outside_the_family()
    {
        var early = await Play(CardVerbs[0], PrefixScenes, asked: 6, correct: 6);
        early!.State.Level.Should().NotBe(VerbLevel.Learned, "the endings have not been examined on the base verb yet");

        await LearnByExam(Base);
        var ordinary = Ladder.Levels[0].Packs.SelectMany(p => p.Verbs).First(l => Families.Of(l) == null);
        (await Play(ordinary, PrefixScenes, asked: 6, correct: 6))!.State.Level.Should().NotBe(VerbLevel.Learned);
        (await Play(Base, PrefixScenes, asked: 6, correct: 6))!.State.Memory.ExamPassed.Should().BeTrue("the base was learned by its exam, and stays so");

        // The check played too early left nothing behind: now that the base is learned it has to be passed again.
        MemberOn(FamilyCard(await Get("verbs/section")), CardVerbs[0])["level"]!.GetValue<string>().Should().NotBe("learned");
    }

    [Test]
    public async Task Member_learned_the_old_way_stays_learned_and_levels_never_go_down()
    {
        // Learned by its own exam before families existed; the base verb was never played.
        await LearnByExam(CardVerbs[1], DateTime.UtcNow.AddDays(-3));
        // Half-way through the old ladder.
        await Play(CardVerbs[3], OrdinaryScenes, at: DateTime.UtcNow.AddDays(-2));

        var card = FamilyCard(await Get("verbs/section"));
        MemberOn(card, CardVerbs[1])["level"]!.GetValue<string>().Should().Be("learned");
        MemberOn(card, CardVerbs[3])["level"]!.GetValue<string>().Should().Be("recognising");
        card["baseLearned"]!.GetValue<bool>().Should().BeFalse();

        // A failed prefix check later takes nothing away from either.
        await LearnByExam(Base);
        (await Play(CardVerbs[1], PrefixScenes, asked: 6, correct: 0))!.State.Level.Should().Be(VerbLevel.Learned);
        (await Play(CardVerbs[3], PrefixScenes, asked: 6, correct: 0))!.State.Level.Should().Be(VerbLevel.Recognising);
    }

    [Test]
    public async Task Member_can_still_be_learned_by_its_own_exam_without_the_base()
    {
        (await LearnByExam(CardVerbs[4]))!.State.Level.Should().Be(VerbLevel.Learned, "the old way stays open");
    }

    // ── Verb card and learning state ─────────────────────────────────────────

    [Test]
    public async Task Card_of_a_member_says_what_it_is_in_the_family_and_the_base_card_lists_the_members()
    {
        var member = Go.Members.First(m => m.Lemma == CardVerbs[0]);

        var card = await Get("verbs/" + Uri.EscapeDataString(member.Lemma));
        card["family"].Should().BeEquivalentToJson(new
        {
            id = "go", baseName = Go.BaseName, role = "member", direction = member.Direction, toward = member.Toward,
            directionRu = member.DirectionRu, lessonModule = "preverbs"
        });
        card["family"]!["prefixes"]!.AsArray().Select(p => p!.GetValue<string>()).Should().Equal(member.Prefixes);
        card["tenses"]!["present"]!.AsArray().Should().OnlyContain(
            cell => cell![0]!.GetValue<string>().StartsWith(member.Prefixes[0]), "the highlighted prefix is really there in every form");
        card["status"]!.GetValue<string>().Should().Be("verified");

        var baseCard = await Get("verbs/" + Uri.EscapeDataString(Base));
        baseCard["family"]!["role"]!.GetValue<string>().Should().Be("base");
        baseCard["family"]!["members"]!.AsArray().Select(m => m!["id"]!.GetValue<string>()).Should().BeEquivalentTo(Go.Members.Select(m => m.Lemma));
        baseCard["family"]!["members"]!.AsArray().Should().OnlyContain(m => m!["title"]!.GetValue<string>().Length > 0 && m["ru"]!.GetValue<string>().Length > 0);

        var ordinary = Ladder.Levels[0].Packs.SelectMany(p => p.Verbs).First(l => Families.Of(l) == null);
        (await Get("verbs/" + Uri.EscapeDataString(ordinary)))["family"].Should().BeNull();
        var related = FamiliesFile["families"]![0]!["related"]![0]!["lemma"]!.GetValue<string>();
        (await Get("verbs/" + Uri.EscapeDataString(related)))["family"].Should().BeNull("a related verb is an ordinary verb");
    }

    [Test]
    public async Task Learning_state_tells_the_mini_app_when_the_session_is_the_prefix_session()
    {
        var before = (await Get($"verbs/{Uri.EscapeDataString(CardVerbs[0])}/learning"))["family"]!;
        before.Should().BeEquivalentToJson(new { id = "go", role = "member", baseId = Base, baseName = Go.BaseName, baseLearned = false, lessonDone = false });

        await LearnByExam(Base);
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var progress = await db.MiniAppUserProgresses.SingleAsync(p => p.UserId == _user.Id);
            progress.CompletedLessonsJson = """{"preverbs":[1,2,3]}""";
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        var after = (await Get($"verbs/{Uri.EscapeDataString(CardVerbs[0])}/learning"))["family"]!;
        after.Should().BeEquivalentToJson(new { baseLearned = true, lessonDone = true });
        (await Get($"verbs/{Uri.EscapeDataString(Base)}/learning"))["family"]!["role"]!.GetValue<string>().Should().Be("base");
    }

    [Test]
    public async Task Family_endpoint_gives_every_member_with_forms_and_the_intro_from_the_prefix_lessons()
    {
        var family = await Get("verbs/families/go");

        family.Should().BeEquivalentToJson(new { id = "go", baseId = Base, baseName = Go.BaseName, baseLearned = false });
        var members = family["members"]!.AsArray();
        members.Select(m => m!["id"]!.GetValue<string>()).Should().Equal(Go.Members.Select(m => m.Lemma));
        foreach (var member in members)
        {
            var lemma = member!["id"]!.GetValue<string>();
            member["tenses"]!["present"]!.ToJsonString().Should().Be(Catalog[lemma]["tenses"]!["present"]!.ToJsonString(), "forms are the catalog's");
            member["tenses"]!.AsObject().Select(t => t.Key).Should().BeEquivalentTo(new[] { "present", "aorist", "imperfect", "optative", "conditional", "future" });
            member["meanings"]!["present"]!.AsArray().Should().HaveCount(6);
        }

        var intro = family["intro"]!;
        intro.Should().BeEquivalentToJson(new { lessonDone = false, moduleId = "preverbs" });
        intro["screens"]!.AsArray().Should().HaveCount(3, "one screen per introductory lesson");
        var known = Go.Members.SelectMany(m => m.Prefixes).ToHashSet();
        intro["screens"]!.AsArray().SelectMany(s => s!["lines"]!.AsArray()).Select(l => l!.GetValue<string>())
            .Should().NotBeEmpty().And.OnlyContain(line => known.Any(p => line.StartsWith(p + "- ")), "only lines about this family's prefixes, as the lesson has them");

        using var client = _app.ClientFor(_user.TelegramId);
        (await client.GetAsync("/api/miniapp/verbs/families/none")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
