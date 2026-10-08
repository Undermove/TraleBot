using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation.Pipeline;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Translation;

/// <summary>
/// Tenses of a model-made verb that real texts do not confirm are kept, marked "unverified", shown only
/// in the verb's card and used nowhere else — until the owner confirms, corrects or removes them.
/// Real pipeline and Postgres, scripted models; Georgian comes from the curated catalog only.
/// </summary>
public class VerbVerificationTests : TranslationPipelineTestBase
{
    private const long OwnerTelegramId = 309149393;

    private static readonly string[] MainTenses = ["present", "imperfect", "future", "conditional", "aorist", "optative"];

    private const string Approve = """{"approve":true,"reasons":["ok"],"missingTenses":[]}""";

    private static readonly string Dance =
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать")["lemma"]!.GetValue<string>();

    private static readonly string Write =
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "писать")["lemma"]!.GetValue<string>();

    private static JsonObject DanceVerb => CatalogVerb(Dance);

    private static string[] Row(string tense) => Enumerable.Range(0, 6).Select(p => Form(DanceVerb, tense, p)).ToArray();

    private static string Record(params string[] tenses) => JsonSerializer.Serialize(new
    {
        verdict = "verb", lemma = Dance, masdar = DanceVerb["title"]!.GetValue<string>(), russian = "танцевать",
        tenses = tenses.ToDictionary(t => t, Row),
        russianForms = new
        {
            inf = "танцевать", present = new[] { "танцую", "танцуешь", "танцует", "танцуем", "танцуете", "танцуют" },
            past = new { m = "танцевал", f = "танцевала", pl = "танцевали" }
        }
    });

    /// <summary>
    /// The verb as the models wrote it, all six tenses. Real texts have the present, the imperfect and the
    /// future in full and half of the conditional; of the aorist two forms, of the optative none.
    /// </summary>
    private async Task StoreVerb(bool withCorpus = true)
    {
        await SeedCatalogWithout(Dance);
        Lexicon.Verbs.Add(new LexiconVerb(Dance, DanceVerb["title"]!.GetValue<string>(), HasTable: false, ["to dance"], ["танцевать"]));
        Lexicon.Attested = withCorpus
            ? Row("present").Concat(Row("imperfect")).Concat(Row("future")).Concat(Row("conditional").Take(3)).Concat(Row("aorist").Take(2)).ToHashSet()
            : null;
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        Models.GeneratorModel.AnswerWith(Record(MainTenses));
        Models.ReviewerModel.AnswerWith(Approve);
        await Translate("танцевать");
    }

    private async Task<JsonNode> StoredCard() => JsonNode.Parse((await StoredVerb(Dance))!.CardJson)!;

    private Task<JsonNode> ServedCard() =>
        InScope(async sp => JsonNode.Parse((await sp.GetRequiredService<VerbQueries>().GetCardJsonAsync(Dance, CancellationToken.None))!)!);

    private static string[] Keys(JsonNode? node) => node!.AsObject().Select(t => t.Key).ToArray();

    private Task<VerbProvenance> Provenance() =>
        InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbProvenances.AsNoTracking().SingleAsync(p => p.Verb.Lemma == Dance));

    private Task<List<VerbForm>> Forms() =>
        InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.AsNoTracking().Where(f => f.Verb.Lemma == Dance).ToListAsync());

    private async Task<User> Learner()
    {
        return await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var user = Create.User(Random.Shared.NextInt64(1_000_000, long.MaxValue), "Learner");
            db.Users.Add(user);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
            await db.SaveChangesAsync(CancellationToken.None);
            return user;
        });
    }

    private Task<VerbLearningState?> State(User user) =>
        InScope(sp => sp.GetRequiredService<VerbLearningService>().GetAsync(user, Dance, 0, DateTime.UtcNow, CancellationToken.None));

    private Task<VerbSessionOutcome?> Play(User user, IEnumerable<(string Tense, int Person)> cells, int examAsked = 0, int examCorrect = 0)
    {
        var now = DateTime.UtcNow;
        var report = new VerbSessionReport(
            Guid.NewGuid(), """{"scenes":[{"type":"meet"}]}""", 0, 3, cells.Select(c => new VerbFormStep(c.Tense, c.Person, 3, 0, now)).ToList(),
            Finished: true, ["meet"], StoryCompleted: false, ExamAsked: examAsked, ExamCorrect: examCorrect);
        return InScope(sp => sp.GetRequiredService<VerbLearningService>().SaveAsync(user, Dance, report, 0, now, CancellationToken.None));
    }

    // ── The state ────────────────────────────────────────────────────────────────────────────────

    [Test]
    public async Task Tense_with_fewer_than_half_of_its_forms_in_real_texts_is_stored_as_unverified_and_served_apart()
    {
        await StoreVerb();

        // Stored: the whole table, with the names of the unverified tenses next to it.
        var stored = await StoredCard();
        Keys(stored["tenses"]).Should().BeEquivalentTo(MainTenses);
        stored["unverifiedTenses"]!.AsArray().Select(t => t!.GetValue<string>()).Should().Equal("aorist", "optative");
        var forms = await Forms();
        forms.Where(f => f.Unverified).Select(f => f.Tense).Distinct().Should().BeEquivalentTo("aorist", "optative");
        forms.Count(f => !f.Unverified).Should().Be(24, because: "exactly half attested is enough: the conditional is verified");

        // Served to a learner: those rows are not in "tenses" — nothing that teaches reads them.
        var served = await ServedCard();
        Keys(served["tenses"]).Should().BeEquivalentTo("present", "imperfect", "future", "conditional");
        Keys(served["meanings"]).Should().BeEquivalentTo("present", "imperfect", "future", "conditional");
        Keys(served["unverified"]).Should().BeEquivalentTo("aorist", "optative");
        served["unverified"]!["aorist"]!.ToJsonString().Should().Be(DanceVerb["tenses"]!["aorist"]!.ToJsonString());
        served["unverifiedMeanings"]!["aorist"]![0]!.GetValue<string>().Should().Be("я танцевал(а)");
        served["unverifiedTenses"].Should().BeNull();
        served["status"]!.GetValue<string>().Should().Be("generated");

        // A curated verb's card has nothing of the kind.
        var curated = await InScope(async sp => JsonNode.Parse((await sp.GetRequiredService<VerbQueries>().GetCardJsonAsync(Write, CancellationToken.None))!)!);
        curated["unverified"].Should().BeNull();
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.CountAsync(f => f.Verb.Lemma == Write && f.Unverified))).Should().Be(0);
    }

    [Test]
    public async Task Without_corpus_data_nothing_can_be_judged_and_every_tense_counts_as_verified()
    {
        await StoreVerb(withCorpus: false);

        (await StoredCard())["unverifiedTenses"]!.AsArray().Should().BeEmpty();
        Keys((await ServedCard())["tenses"]).Should().BeEquivalentTo(MainTenses);
    }

    // ── Who skips unverified rows ────────────────────────────────────────────────────────────────

    [Test]
    public async Task Unverified_form_is_not_parsed_not_found_in_texts_and_gets_no_parse_line_but_is_still_translated_with_a_note()
    {
        await StoreVerb();
        var unverified = Form(DanceVerb, "aorist", 5);
        var verified = Form(DanceVerb, "future", 5);

        (await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(unverified, CancellationToken.None))).Should().BeEmpty();
        (await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(verified, CancellationToken.None))).Should().ContainSingle();
        var inTexts = await InScope(sp => sp.GetRequiredService<VerbQueries>().FindInTextsAsync([unverified, verified], CancellationToken.None));
        inTexts.Keys.Should().Equal(verified);
        (await InScope(sp => sp.GetRequiredService<VerbReplyHintQuery>().FindAsync([unverified], CancellationToken.None))).Should().BeNull();
        (await InScope(sp => sp.GetRequiredService<VerbReplyHintQuery>().FindAsync([verified], CancellationToken.None)))!.Tense.Should().Be("future");

        // The translation itself is still the best the base has — and says what it is worth.
        var calls = Models.ModelCalls;
        var answer = (TranslationResult.Success)await Translate(unverified);
        answer.Definition.Should().Be("они танцевали");
        answer.AdditionalInfo.Should().Contain(GeorgianTranslationPipeline.UnverifiedFormNote);
        ((TranslationResult.Success)await Translate(verified)).AdditionalInfo.Should().NotContain(GeorgianTranslationPipeline.UnverifiedFormNote);
        Models.ModelCalls.Should().Be(calls);
    }

    [Test]
    public async Task Learning_counts_and_teaches_verified_tenses_only_so_the_verb_can_still_be_learned()
    {
        await StoreVerb();
        var user = await Learner();

        var before = await State(user);
        before!.Progress.CanLearn.Should().BeTrue();
        before.Progress.Total.Should().Be(24, because: "two of the six tenses are unverified");

        // Sixteen solid forms of 24 make the verb ready for the exam; of 36 they would not.
        var cells = new[] { "present", "imperfect", "future" }.SelectMany(t => Enumerable.Range(0, 6).Select(p => (t, p))).Take(16).ToList();
        var played = await Play(user, cells.Append(("aorist", 0)).Append(("optative", 3)));
        played!.State.Progress.Forms.Select(f => (f.Tense, f.Person)).Should().BeEquivalentTo(cells, because: "a step for an unverified cell is not taken");
        played.State.Level.Should().Be(VerbLevel.ExamReady);

        var examined = await Play(user, [], examAsked: 6, examCorrect: 6);
        examined!.State.Level.Should().Be(VerbLevel.Learned);
    }

    // ── The «Глаголы» section ────────────────────────────────────────────────────────────────────

    private Task<VerbSection> Section(User learner) => InScope(async sp =>
    {
        var user = await sp.GetRequiredService<ITraleDbContext>().Users.Include(u => u.Settings).SingleAsync(u => u.Id == learner.Id);
        return await sp.GetRequiredService<VerbSectionQuery>().GetAsync(user, alphabetLessons: 99, DateTime.UtcNow, CancellationToken.None);
    });

    [Test]
    public async Task Section_shows_a_model_made_verb_with_progress_over_verified_tenses_and_never_calls_to_repeat_an_unverified_form()
    {
        await StoreVerb();
        var user = await Learner();
        var cells = new[] { "present", "imperfect", "future" }.SelectMany(t => Enumerable.Range(0, 6).Select(p => (t, p))).Take(16).ToList();
        await Play(user, cells);

        // «Мои глаголы»: the verb with its origin mark and the level reached over what is taught (16 of 24, not of 36).
        var section = await Section(user);
        var mine = section.MyVerbs.Single(v => v.Lemma == Dance);
        (mine.Generated, mine.Level).Should().Be((true, VerbLevel.ExamReady));
        (section.Next!.Kind, section.Next.Lemma, section.Next.Level).Should().Be((VerbSectionQuery.Continue, Dance, VerbLevel.ExamReady));

        // Learned by the exam; a form of the aorist — confirmed by the owner at the time — is due for repetition.
        await Play(user, [], examAsked: 6, examCorrect: 6);
        await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "aorist" });
        await Play(user, [("aorist", 0)]);
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var row = await db.VerbFormProgresses.SingleAsync(p => p.UserId == user.Id && p.Tense == "aorist");
            (row.Step, row.BestStep, row.NextDueAtUtc) = (VerbFormProgress.MasteredStep, VerbFormProgress.MasteredStep, DateTime.UtcNow.AddDays(-1));
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        section = await Section(user);
        (section.Next!.Kind, section.Next.Lemma, section.Next.Due).Should().Be((VerbSectionQuery.Review, Dance, 1));

        // The tense becomes unverified again (as a rebuild can make it): sessions do not ask it, so nothing is "due".
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var verb = await db.Verbs.SingleAsync(v => v.Lemma == Dance);
            var tenses = JsonNode.Parse(verb.CardJson)!["tenses"].Deserialize<Dictionary<string, string[][]>>()!;
            await sp.GetRequiredService<RuntimeVerbStore>().RewriteGeneratedAsync(verb, tenses, ["aorist", "optative"], CancellationToken.None);
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        section = await Section(user);
        section.Next!.Lemma.Should().NotBe(Dance, because: "a learned verb with nothing to repeat is not what to do now");
        section.Next.Kind.Should().Be(VerbSectionQuery.New);
        section.MyVerbs.Single(v => v.Lemma == Dance).Level.Should().Be(VerbLevel.Learned, because: "a level never goes down");
        (await State(user))!.Progress.Total.Should().Be(24);
    }

    // ── The owner's review ───────────────────────────────────────────────────────────────────────

    private static string InitData(long telegramId)
    {
        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["auth_date"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
            ["query_id"] = "test",
            ["user"] = JsonSerializer.Serialize(new { id = telegramId, first_name = "Someone" })
        };
        var check = string.Join("\n", fields.Select(f => $"{f.Key}={f.Value}"));
        var secret = HMACSHA256.HashData(Encoding.UTF8.GetBytes("WebAppData"), Encoding.UTF8.GetBytes(BotToken));
        fields["hash"] = Convert.ToHexString(HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(check))).ToLowerInvariant();
        return string.Join("&", fields.Select(f => $"{f.Key}={Uri.EscapeDataString(f.Value)}"));
    }

    private async Task<(HttpStatusCode Status, JsonNode? Body)> Admin(HttpMethod method, string path, object? body = null, long telegramId = OwnerTelegramId)
    {
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            if (!await db.Users.AnyAsync(u => u.TelegramId == telegramId))
            {
                var user = Create.User(telegramId, "Someone");
                db.Users.Add(user);
                db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
                await db.SaveChangesAsync(CancellationToken.None);
            }

            return 0;
        });
        using var client = App.CreateClient();
        using var request = new HttpRequestMessage(method, $"/api/admin/{path}");
        request.Headers.Add("X-Telegram-Init-Data", InitData(telegramId));
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }

        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, text.Length == 0 ? null : JsonNode.Parse(text));
    }

    [Test]
    public async Task Owner_sees_each_unverified_tense_with_its_forms_and_which_of_them_real_texts_have()
    {
        await StoreVerb();

        var all = await Admin(HttpMethod.Get, "verbs/model-made");
        var listed = await Admin(HttpMethod.Get, "verbs/model-made?unverified=true");

        listed.Status.Should().Be(HttpStatusCode.OK);
        var row = listed.Body!["verbs"]!.AsArray().Single()!;
        (row["mainTenses"]!.GetValue<int>(), row["verifiedMainTenses"]!.GetValue<int>()).Should().Be((6, 4));
        var tenses = row["unverifiedTenses"]!.AsArray();
        tenses.Select(t => t!["tense"]!.GetValue<string>()).Should().Equal("aorist", "optative");
        tenses[0]!["cells"]!.AsArray().Select(c => c!.GetValue<string>()).Should().Equal(Row("aorist"));
        tenses[0]!["inTexts"]!.AsArray().Select(c => c!.GetValue<bool>()).Should().Equal(true, true, false, false, false, false);
        tenses[0]!["phrases"]![2]!.GetValue<string>().Should().Be("он танцевал");
        row["reviewerReasons"]!.AsArray().Should().ContainSingle();
        all.Body!["count"]!.GetValue<int>().Should().Be(1);

        // A verb with nothing to check is not in the "to check" list.
        await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "aorist" });
        await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "optative" });
        (await Admin(HttpMethod.Get, "verbs/model-made?unverified=true")).Body!["count"]!.GetValue<int>().Should().Be(0);
        (await Admin(HttpMethod.Get, "verbs/model-made")).Body!["verbs"]![0]!["verifiedMainTenses"]!.GetValue<int>().Should().Be(6);
    }

    [Test]
    public async Task Confirmed_tense_becomes_verified_enters_learning_and_the_action_is_on_record()
    {
        await StoreVerb();
        var user = await Learner();

        var confirmed = await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "aorist" });

        confirmed.Status.Should().Be(HttpStatusCode.OK);
        (await StoredCard())["unverifiedTenses"]!.AsArray().Select(t => t!.GetValue<string>()).Should().Equal("optative");
        Keys((await ServedCard())["tenses"]).Should().Contain("aorist").And.NotContain("optative");
        (await ServedCard())["meanings"]!["aorist"]![0]!.GetValue<string>().Should().Be("я танцевал(а)");
        (await State(user))!.Progress.Total.Should().Be(30);
        (await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(Form(DanceVerb, "aorist", 5), CancellationToken.None))).Should().ContainSingle();
        (await Play(user, [("aorist", 0)]))!.State.Progress.Forms.Should().ContainSingle();

        var review = JsonNode.Parse((await Provenance()).TenseReviewsJson)!.AsArray().Single()!;
        (review["tense"]!.GetValue<string>(), review["action"]!.GetValue<string>(), review["by"]!.GetValue<long>()).Should().Be(("aorist", "confirmed", OwnerTelegramId));
        review["before"]!.AsArray().Select(c => c!.GetValue<string>()).Should().Equal(Row("aorist"));
        review["after"]!.ToJsonString().Should().Be(review["before"]!.ToJsonString());
        DateTimeOffset.Parse(review["atUtc"]!.GetValue<string>()).UtcDateTime.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
    }

    [Test]
    public async Task Edited_tense_is_verified_keeps_the_owners_words_and_only_the_changed_cells_lose_their_progress()
    {
        await StoreVerb();
        var user = await Learner();
        await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "aorist" });
        await Play(user, [("aorist", 0), ("aorist", 1), ("present", 0)]);
        // The owner's correction: another word in the "I" cell (a catalog form, not invented Georgian), "you pl" emptied.
        var corrected = Form(CatalogVerb(Write), "aorist", 0);
        var cells = Row("aorist").Cast<string?>().ToArray();
        cells[0] = corrected;
        cells[4] = "";

        var edited = await Admin(HttpMethod.Post, "verbs/tense/edit", new { lemma = Dance, tense = "aorist", cells });

        edited.Status.Should().Be(HttpStatusCode.OK);
        edited.Body!["progressReset"]!.GetValue<int>().Should().Be(1, because: "one learner had learned the word that is not there any more");
        var card = await StoredCard();
        card["tenses"]!["aorist"]![0]![0]!.GetValue<string>().Should().Be(corrected);
        card["tenses"]!["aorist"]![4]!.AsArray().Should().BeEmpty();
        card["tenses"]!["aorist"]![1]!.ToJsonString().Should().Be(DanceVerb["tenses"]!["aorist"]![1]!.ToJsonString());
        card["unverifiedTenses"]!.AsArray().Select(t => t!.GetValue<string>()).Should().Equal("optative");
        (await Forms()).Should().Contain(f => f.Form == corrected && f.Tense == "aorist" && !f.Unverified && f.Meaning == "я танцевал(а)");
        (await Forms()).Should().NotContain(f => f.Form == Form(DanceVerb, "aorist", 0) && f.Tense == "aorist");

        var state = await State(user);
        state!.Progress.Forms.Select(f => (f.Tense, f.Person)).Should().BeEquivalentTo(new[] { ("aorist", 1), ("present", 0) });
        state.Progress.Total.Should().Be(29, because: "the emptied cell is not a form to learn");

        var reviews = JsonNode.Parse((await Provenance()).TenseReviewsJson)!.AsArray();
        reviews.Select(r => r!["action"]!.GetValue<string>()).Should().Equal("confirmed", "edited");
        reviews[1]!["before"]![0]!.GetValue<string>().Should().Be(Form(DanceVerb, "aorist", 0));
        reviews[1]!["after"]![0]!.GetValue<string>().Should().Be(corrected);
        reviews[1]!["after"]![4].Should().BeNull();

        // What is not a row of Georgian words is refused and changes nothing.
        var before = (await StoredVerb(Dance))!.CardJson;
        cells[0] = "tsekva";
        (await Admin(HttpMethod.Post, "verbs/tense/edit", new { lemma = Dance, tense = "aorist", cells })).Status.Should().Be(HttpStatusCode.BadRequest);
        cells[0] = $"{corrected} {corrected}";
        (await Admin(HttpMethod.Post, "verbs/tense/edit", new { lemma = Dance, tense = "aorist", cells })).Body!["error"]!.GetValue<string>().Should().Be("invalid_cells");
        (await Admin(HttpMethod.Post, "verbs/tense/edit", new { lemma = Dance, tense = "aorist", cells = cells.Take(5) })).Status.Should().Be(HttpStatusCode.BadRequest);
        (await Admin(HttpMethod.Post, "verbs/tense/edit", new { lemma = Dance, tense = "aorist", cells = new string?[6] })).Status.Should().Be(HttpStatusCode.BadRequest);
        var present = Row("present");
        present[2] = corrected;
        (await Admin(HttpMethod.Post, "verbs/tense/edit", new { lemma = Dance, tense = "present", cells = present })).Body!["error"]!.GetValue<string>().Should().Be("present_stays");
        (await StoredVerb(Dance))!.CardJson.Should().Be(before);
        JsonNode.Parse((await Provenance()).TenseReviewsJson)!.AsArray().Should().HaveCount(2);
    }

    [Test]
    public async Task Removed_tense_is_gone_with_its_progress_and_a_rebuild_brings_it_back_only_as_unverified()
    {
        await StoreVerb();
        var user = await Learner();
        await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "future" });
        await Play(user, [("future", 0), ("future", 1), ("present", 0)]);

        var removed = await Admin(HttpMethod.Post, "verbs/tense/remove", new { lemma = Dance, tense = "future" });

        removed.Body!["progressReset"]!.GetValue<int>().Should().Be(2);
        var card = await StoredCard();
        Keys(card["tenses"]).Should().NotContain("future");
        Keys(card["meanings"]).Should().NotContain("future");
        (await Forms()).Should().NotContain(f => f.Tense == "future");
        (await State(user))!.Progress.Forms.Select(f => (f.Tense, f.Person)).Should().Equal(("present", 0));
        var row = (await Admin(HttpMethod.Get, "verbs/model-made")).Body!["verbs"]![0]!;
        row["mainTenses"]!.GetValue<int>().Should().Be(5);
        row["missingTenses"]!.AsArray().Single()!["why"]!.GetValue<string>().Should().Be("removed-by-owner");
        row["tenseReviews"]!.AsArray().Select(r => r!["action"]!.GetValue<string>()).Should().Equal("confirmed", "removed");
        (await Admin(HttpMethod.Post, "verbs/tense/remove", new { lemma = Dance, tense = "future" })).Status.Should().Be(HttpStatusCode.NotFound);
        (await Admin(HttpMethod.Post, "verbs/tense/remove", new { lemma = Dance, tense = "present" })).Status.Should().Be(HttpStatusCode.BadRequest);

        // The owner also corrects the conditional by hand; then the verb is rebuilt by the models.
        var corrected = Form(CatalogVerb(Write), "conditional", 0);
        var cells = Row("conditional");
        cells[0] = corrected;
        await Admin(HttpMethod.Post, "verbs/tense/edit", new { lemma = Dance, tense = "conditional", cells });
        var rebuilt = await Admin(HttpMethod.Post, "verbs/regenerate", new { lemma = Dance });

        rebuilt.Body!["outcome"]!.GetValue<string>().Should().Be("replaced");
        card = await StoredCard();
        Keys(card["tenses"]).Should().BeEquivalentTo(MainTenses);
        card["unverifiedTenses"]!.AsArray().Select(t => t!.GetValue<string>()).Should().Equal(
            ["aorist", "optative", "future"], because: "real texts have the whole future, but the owner had taken it out: it does not come back verified silently");
        card["tenses"]!["conditional"]![0]![0]!.GetValue<string>().Should().Be(corrected, because: "a row the owner wrote outlives a rebuild");
        var listed = (await Admin(HttpMethod.Get, "verbs/model-made?unverified=true")).Body!["verbs"]![0]!["unverifiedTenses"]!.AsArray();
        listed.Single(t => t!["tense"]!.GetValue<string>() == "future")!["removedBefore"]!.GetValue<bool>().Should().BeTrue();
        JsonNode.Parse((await Provenance()).TenseReviewsJson)!.AsArray().Should().HaveCount(3, because: "the owner's journal outlives a rebuild too");
    }

    [Test]
    public async Task Review_actions_are_for_the_owner_and_for_model_made_verbs_only()
    {
        await StoreVerb();
        var body = new { lemma = Dance, tense = "aorist" };
        var before = (await StoredVerb(Dance))!.CardJson;

        foreach (var action in new[] { "confirm", "edit", "remove" })
        {
            (await Admin(HttpMethod.Post, $"verbs/tense/{action}", body, telegramId: 777002)).Status.Should().Be(HttpStatusCode.NotFound);
            (await Admin(HttpMethod.Post, $"verbs/tense/{action}", new { lemma = Write, tense = "aorist", cells = Row("aorist") })).Status
                .Should().Be(HttpStatusCode.Conflict, because: "a curated verb is never touched");
        }

        (await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "perfect" })).Status.Should().Be(HttpStatusCode.NotFound);
        (await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Form(DanceVerb, "present", 0), tense = "aorist" })).Status.Should().Be(HttpStatusCode.NotFound);
        (await StoredVerb(Dance))!.CardJson.Should().Be(before);
        JsonNode.Parse((await StoredVerb(Write))!.CardJson)!["tenses"]!.ToJsonString().Should().Be(CatalogVerb(Write)["tenses"]!.ToJsonString());
        (await Provenance()).TenseReviewsJson.Should().Be("[]");
    }

    // ── «Глагол проверен» ────────────────────────────────────────────────────────────────────────

    private Task<string> ListedStatus() => InScope(async sp =>
        RuntimeVerbStore.StatusName((await sp.GetRequiredService<VerbQueries>().ListAsync(CancellationToken.None)).Single(v => v.Lemma == Dance).Status));

    [Test]
    public async Task Verb_approved_by_the_owner_is_a_verified_verb_for_learners_and_the_mark_can_be_taken_off()
    {
        await StoreVerb();
        var user = await Learner();
        await Play(user, [("present", 0)]);
        (await ServedCard())["status"]!.GetValue<string>().Should().Be("generated");

        // With unverified tenses left the owner has to say "all of it" explicitly.
        var refused = await Admin(HttpMethod.Post, "verbs/approve", new { lemma = Dance });
        (refused.Status, refused.Body!["error"]!.GetValue<string>()).Should().Be((HttpStatusCode.Conflict, "has_unverified_tenses"));
        (await StoredVerb(Dance))!.Status.Should().Be(VerbStatus.Generated);

        var approved = await Admin(HttpMethod.Post, "verbs/approve", new { lemma = Dance, confirmAll = true });

        approved.Status.Should().Be(HttpStatusCode.OK);
        (await StoredVerb(Dance))!.Status.Should().Be(VerbStatus.OwnerApproved);
        var served = await ServedCard();
        served["status"]!.GetValue<string>().Should().Be("verified", because: "that is what takes the «составлено нейросетью» line off the card");
        Keys(served["tenses"]).Should().BeEquivalentTo(MainTenses, because: "every tense is verified and in games");
        served["unverified"].Should().BeNull();
        (await ListedStatus()).Should().Be("verified");
        (await State(user))!.Progress.Total.Should().Be(36);
        (await Forms()).Should().NotContain(f => f.Unverified);
        (await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(Form(DanceVerb, "optative", 0), CancellationToken.None))).Should().ContainSingle();
        (await Section(user)).MyVerbs.Single(v => v.Lemma == Dance).Generated.Should().BeFalse(because: "the section's mark goes too");

        var provenance = await Provenance();
        provenance.OwnerApprovedBy.Should().Be(OwnerTelegramId);
        provenance.OwnerApprovedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
        JsonNode.Parse(provenance.TenseReviewsJson)!.AsArray().Select(r => (r!["tense"]!.GetValue<string>(), r["action"]!.GetValue<string>()))
            .Should().Equal(("aorist", "confirmed"), ("optative", "confirmed"), ("*", "verb-approved"));

        // The owner still sees it in the list — as approved — and can still correct a tense.
        var row = (await Admin(HttpMethod.Get, "verbs/model-made")).Body!["verbs"]!.AsArray().Single()!;
        row["ownerApprovedAtUtc"].Should().NotBeNull();
        row["tenses"]!.AsArray().Should().HaveCount(6).And.OnlyContain(t => !t!["unverified"]!.GetValue<bool>());
        (await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "aorist" })).Status.Should().Be(HttpStatusCode.OK);
        (await StoredVerb(Dance))!.Status.Should().Be(VerbStatus.OwnerApproved);

        // «Снять отметку».
        (await Admin(HttpMethod.Post, "verbs/unapprove", new { lemma = Dance })).Status.Should().Be(HttpStatusCode.OK);
        (await StoredVerb(Dance))!.Status.Should().Be(VerbStatus.Generated);
        (await ServedCard())["status"]!.GetValue<string>().Should().Be("generated");
        Keys((await ServedCard())["tenses"]).Should().BeEquivalentTo(MainTenses, because: "the tenses the owner confirmed stay confirmed");
        (await Provenance()).OwnerApprovedAtUtc.Should().BeNull();
        (await Section(user)).MyVerbs.Single(v => v.Lemma == Dance).Generated.Should().BeTrue();

        // Without unverified tenses the plain action is enough; nobody but the owner, and no curated verb.
        (await Admin(HttpMethod.Post, "verbs/approve", new { lemma = Dance })).Status.Should().Be(HttpStatusCode.OK);
        (await Admin(HttpMethod.Post, "verbs/approve", new { lemma = Write, confirmAll = true })).Status.Should().Be(HttpStatusCode.Conflict);
        (await Admin(HttpMethod.Post, "verbs/unapprove", new { lemma = Write })).Status.Should().Be(HttpStatusCode.Conflict);
        (await Admin(HttpMethod.Post, "verbs/approve", new { lemma = Dance }, telegramId: 777003)).Status.Should().Be(HttpStatusCode.NotFound);
        (await Admin(HttpMethod.Post, "verbs/unapprove", new { lemma = Dance }, telegramId: 777003)).Status.Should().Be(HttpStatusCode.NotFound);
        (await StoredVerb(Write))!.Status.Should().Be(VerbStatus.Verified);
        (await StoredVerb(Dance))!.Status.Should().Be(VerbStatus.OwnerApproved);
    }

    [Test]
    public async Task Approved_verb_is_rebuilt_only_on_the_owners_explicit_word_and_then_needs_review_again()
    {
        await StoreVerb();
        await Admin(HttpMethod.Post, "verbs/approve", new { lemma = Dance, confirmAll = true });
        var before = (await StoredVerb(Dance))!.CardJson;
        var calls = Models.ModelCalls;

        var refused = await Admin(HttpMethod.Post, "verbs/regenerate", new { lemma = Dance });

        (refused.Status, refused.Body!["error"]!.GetValue<string>()).Should().Be((HttpStatusCode.Conflict, "approved_by_owner"));
        Models.ModelCalls.Should().Be(calls, because: "nothing is asked of the models without the owner's word");
        (await StoredVerb(Dance))!.CardJson.Should().Be(before);

        // A rebuild that is not accepted leaves the verb approved.
        Models.ReviewerModel.AnswerWith("""{"approve":false,"reasons":["no"]}""");
        var kept = await Admin(HttpMethod.Post, "verbs/regenerate", new { lemma = Dance, evenIfApproved = true });
        kept.Body!["outcome"]!.GetValue<string>().Should().Be("kept");
        (await StoredVerb(Dance))!.Status.Should().Be(VerbStatus.OwnerApproved);

        // An accepted one brings it back to "to be looked over": the mark returns, the approval goes.
        Models.ReviewerModel.AnswerWith(Approve);
        var rebuilt = await Admin(HttpMethod.Post, "verbs/regenerate", new { lemma = Dance, evenIfApproved = true });
        rebuilt.Body!["outcome"]!.GetValue<string>().Should().Be("replaced");
        (await StoredVerb(Dance))!.Status.Should().Be(VerbStatus.Generated);
        (await ServedCard())["status"]!.GetValue<string>().Should().Be("generated");
        (await Provenance()).OwnerApprovedAtUtc.Should().BeNull();
        Keys((await ServedCard())["tenses"]).Should().BeEquivalentTo(MainTenses, because: "rows the owner confirmed outlive a rebuild");
    }

    [Test]
    public async Task Curated_verb_with_the_same_lemma_still_replaces_an_approved_model_made_one()
    {
        await StoreVerb();
        await Admin(HttpMethod.Post, "verbs/approve", new { lemma = Dance, confirmAll = true });

        await InScope(sp => sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(
            new JsonObject { ["verbs"] = Catalog().DeepClone() }.ToJsonString(), CancellationToken.None));

        var verb = await StoredVerb(Dance);
        verb!.Status.Should().Be(VerbStatus.Verified);
        RuntimeVerbStore.IsRuntime(verb).Should().BeFalse();
        JsonNode.Parse(verb.CardJson)!["tenses"]!.ToJsonString().Should().Be(DanceVerb["tenses"]!.ToJsonString());
        (await Admin(HttpMethod.Get, "verbs/model-made")).Body!["count"]!.GetValue<int>().Should().Be(0);
    }

    // ── A record stored before all this ──────────────────────────────────────────────────────────

    [Test]
    public async Task Verb_stored_before_tenses_had_a_state_gets_it_at_startup_by_the_same_rule_once()
    {
        await StoreVerb();
        await InScope(async sp =>
        {
            // As an older build left it: no word about verification in the card, every form "verified".
            var db = sp.GetRequiredService<ITraleDbContext>();
            var verb = await db.Verbs.SingleAsync(v => v.Lemma == Dance);
            var card = JsonNode.Parse(verb.CardJson)!.AsObject();
            card.Remove("unverifiedTenses");
            verb.CardJson = card.ToJsonString(new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
            foreach (var form in await db.VerbForms.Where(f => f.VerbId == verb.Id).ToListAsync())
            {
                form.Unverified = false;
            }

            return await db.SaveChangesAsync(CancellationToken.None);
        });
        var id = (await StoredVerb(Dance))!.Id;
        Keys((await ServedCard())["tenses"]).Should().HaveCount(6, because: "until the backfill runs the old record is served as it was");

        var marked = await InScope(sp => sp.GetRequiredService<VerbVerificationBackfill>().RunAsync(CancellationToken.None));

        marked.Should().Be(1, because: "catalog verbs and verbs from a source table are not looked at");
        (await StoredCard())["unverifiedTenses"]!.AsArray().Select(t => t!.GetValue<string>()).Should().Equal("aorist", "optative");
        (await Forms()).Where(f => f.Unverified).Select(f => f.Tense).Distinct().Should().BeEquivalentTo("aorist", "optative");
        (await StoredVerb(Dance))!.Id.Should().Be(id);
        Keys((await ServedCard())["tenses"]).Should().HaveCount(4);

        // The owner's decision is not overwritten by the next start.
        await Admin(HttpMethod.Post, "verbs/tense/confirm", new { lemma = Dance, tense = "aorist" });
        (await InScope(sp => sp.GetRequiredService<VerbVerificationBackfill>().RunAsync(CancellationToken.None))).Should().Be(0);
        (await StoredCard())["unverifiedTenses"]!.AsArray().Select(t => t!.GetValue<string>()).Should().Equal("optative");
    }

    [Test]
    public async Task Review_list_can_be_pulled_with_the_sql_file_without_the_admin_screen()
    {
        await StoreVerb();
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !File.Exists(Path.Combine(directory.FullName, "scripts", "sql", "verbs-unverified-tenses.sql")))
        {
            directory = directory.Parent;
        }

        var sql = await File.ReadAllTextAsync(Path.Combine(directory!.FullName, "scripts", "sql", "verbs-unverified-tenses.sql"));

        var rows = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<Persistence.TraleDbContext>();
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = sql;
            await db.Database.OpenConnectionAsync();
            var read = new List<(string Lemma, string Tense, string Forms, string Phrases)>();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                read.Add((reader.GetString(0), reader.GetString(2), reader.GetString(3), reader.GetString(4)));
            }

            return read;
        });

        rows.Select(r => (r.Lemma, r.Tense)).Should().Equal((Dance, "aorist"), (Dance, "optative"));
        rows[0].Forms.Should().Be(string.Join(" | ", Row("aorist")));
        rows[0].Phrases.Should().StartWith("я танцевал(а) | ");
    }
}
