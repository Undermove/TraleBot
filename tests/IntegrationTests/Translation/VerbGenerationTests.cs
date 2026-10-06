using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation.Cache;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Translation;

/// <summary>
/// A verb that neither the base nor a Wiktionary table has: written by the generator, gated by our
/// code, approved by the reviewer, stored with its provenance — and from then on a verb like any other.
/// Real pipeline, real agents, real Postgres; the four models answer from scripts.
/// Georgian comes from the curated catalog only: the "generated" verb is a catalog verb taken out of the
/// seeded base, and what the fake generator "writes" is that verb's catalog table.
/// </summary>
public class VerbGenerationTests : TranslationPipelineTestBase
{
    private static readonly string[] MainTenses = ["present", "imperfect", "future", "conditional", "aorist", "optative"];

    private const string VerbByInfinitive = """{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""";
    private const string AVerb = """{"notTranslatable":false,"isVerb":true,"russianInfinitive":null}""";
    private const string Approve = """{"approve":true,"reasons":["The paradigm is consistent and the lemma is the verb for the gloss."]}""";

    private static string LemmaOf(string russian) =>
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == russian)["lemma"]!.GetValue<string>();

    private static readonly string Dance = LemmaOf("танцевать");
    private static readonly string Write = LemmaOf("писать");

    private static JsonObject DanceVerb => CatalogVerb(Dance);

    /// <summary>The record the generator writes: the catalog table of the verb, optionally with some cells changed.</summary>
    private static string Record(
        Func<string, int, string?>? cell = null, string? matchedTense = null, int? matchedPerson = null, string? russian = "танцевать")
    {
        var verb = DanceVerb;
        return JsonSerializer.Serialize(new
        {
            verdict = "verb",
            lemma = Dance,
            masdar = verb["title"]!.GetValue<string>(),
            russian,
            tenses = MainTenses.ToDictionary(
                t => t, t => Enumerable.Range(0, 6).Select(p => cell == null ? Form(verb, t, p) : cell(t, p)).ToArray()),
            russianForms = new
            {
                inf = "танцевать",
                present = new[] { "танцую", "танцуешь", "танцует", "танцуем", "танцуете", "танцуют" },
                past = new { m = "танцевал", f = "танцевала", pl = "танцевали" }
            },
            matchedTense,
            matchedPerson
        });
    }

    private static string Reject(params string[] reasons) => JsonSerializer.Serialize(new { approve = false, reasons });

    private void LexiconKnowsDanceWithoutATable() =>
        Lexicon.Verbs.Add(new LexiconVerb(Dance, DanceVerb["title"]!.GetValue<string>(), HasTable: false, ["to dance"], ["танцевать"]));

    private Task<VerbProvenance?> Provenance(string lemma) =>
        InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbProvenances.AsNoTracking().FirstOrDefaultAsync(p => p.Verb.Lemma == lemma));

    private static string LastUserText(FakeChatClient model) =>
        model.Conversations.Last().Last(m => m.Role == ChatRole.User).Text;

    // ── Generation → approval → stored → served from the table ───────────────────────────────────

    [Test]
    public async Task Verb_with_no_table_is_written_approved_stored_and_then_served_with_no_model_call()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        var allForms = MainTenses.SelectMany(t => Enumerable.Range(0, 6).Select(p => Form(DanceVerb, t, p))).ToList();
        Lexicon.Attested = allForms.Take(30).ToHashSet();
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.GeneratorModel.AnswerWith(Record());
        Models.ReviewerModel.AnswerWith(Approve);

        var result = await Translate("танцевать");

        // The lexicon names the verb and says there is no table: no analyst call, straight to the generator.
        Log.Paths.Should().Equal("lexicon-no-table>generator>stored");
        Models.AnalystModel.Calls.Should().Be(0);
        Models.GeneratorModel.Calls.Should().Be(1);
        Models.ReviewerModel.Calls.Should().Be(1);
        var answer = result.Should().BeOfType<TranslationResult.Success>().Subject;
        answer.Definition.Should().Be(Dance);
        answer.AdditionalInfo.Should().Contain($"название действия: {DanceVerb["title"]!.GetValue<string>()}");

        // Stored like a catalog verb: the table, the phrases of every cell, the classification by our code.
        var stored = await StoredVerb(Dance);
        stored!.Status.Should().Be(VerbStatus.Generated);
        stored.Translation.Should().Be("танцевать");
        var card = JsonNode.Parse(stored.CardJson)!;
        card["meanings"]!.ToJsonString().Should().Be(DanceVerb["meanings"]!.ToJsonString(), because: "the phrases are built by the catalog's rules");
        card["meaningChips"]!.ToJsonString().Should().Be(DanceVerb["meaningChips"]!.ToJsonString());
        card["kind"]!.GetValue<string>().Should().Be(DanceVerb["kind"]!.GetValue<string>(), because: "the classification is computed, not asked from a model");
        card["source"].Should().BeNull();

        // The reviewer was shown the record with our evidence.
        var shown = LastUserText(Models.ReviewerModel);
        shown.Should().Contain($"lemma: {Dance}").And.Contain("«я танцую»");
        shown.Should().Contain("Attested in corpora of real texts: 30 of 36 forms.").And.Contain(allForms[35]);
        shown.Should().Contain("Wiktionary lexicon, this lemma:");

        // Provenance: who wrote, who approved, on what evidence.
        var provenance = await Provenance(Dance);
        provenance!.GeneratorModel.Should().Be("gpt-6-astra");
        provenance.ReviewerModel.Should().Be("gpt-6-sol");
        provenance.AskedText.Should().Be("танцевать");
        provenance.RepairRounds.Should().Be(0);
        (provenance.FormsTotal, provenance.FormsAttested).Should().Be((36, 30));
        JsonSerializer.Deserialize<List<string>>(provenance.UnattestedFormsJson).Should().BeEquivalentTo(allForms.Skip(30));
        provenance.LemmaInLexicon.Should().BeTrue();
        provenance.ReviewerReasons.Should().Contain("The paradigm is consistent");
        provenance.RevisedAtUtc.Should().BeNull();

        // From now on: the same text, a Russian form, a Georgian form — all from the table.
        var calls = Models.ModelCalls;
        Log.Reset();
        (await Translate("Танцевать")).Should().Be(result);
        var iDanced = (TranslationResult.Success)await Translate("я танцевал");
        var theyDance = (TranslationResult.Success)await Translate(Form(DanceVerb, "present", 5));
        iDanced.Definition.Should().Be(Form(DanceVerb, "imperfect", 0));
        theyDance.Definition.Should().Be("они танцуют");
        Models.ModelCalls.Should().Be(calls, because: "a verb written once is served from the base");
        External.Calls.Should().Be(0);
        Log.Paths.Should().Equal("verb-base", "verb-base", "verb-base");
        (await CacheEntries()).Should().BeEmpty(because: "every answer came from the verb base, nothing needed the cache");
    }

    [Test]
    public async Task Inflected_russian_form_gets_its_own_cell_from_the_new_table_on_the_very_first_request()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.GeneratorModel.AnswerWith(Record(matchedTense: "present", matchedPerson: 0));
        Models.ReviewerModel.AnswerWith(Approve);

        var result = (TranslationResult.Success)await Translate("я танцую");

        result.Definition.Should().Be(Form(DanceVerb, "present", 0));
        LastUserText(Models.GeneratorModel).Should().StartWith("Russian verb: танцевать\nTyped: я танцую");
        LastUserText(Models.ReviewerModel).Should().Contain($"Matched to: {Form(DanceVerb, "present", 0)} — present, I.");

        Log.Reset();
        (await Translate("я танцую")).Should().Be(result, because: "the first answer is the one the table gives ever after");
        Log.Paths.Should().Equal("verb-base");
        Models.ModelCalls.Should().Be(3);
    }

    [Test]
    public async Task Georgian_form_goes_through_the_cheap_agent_first_and_is_answered_with_its_phrase()
    {
        await SeedCatalogWithout(Dance);
        var form = Form(DanceVerb, "aorist", 2);
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith(JsonSerializer.Serialize(new { outcome = "noTable", lemma = Dance, russian = "танцевать" }));
        Models.GeneratorModel.AnswerWith(Record());
        Models.ReviewerModel.AnswerWith(Approve);

        var result = (TranslationResult.Success)await Translate(form);

        Log.Paths.Should().Equal("analyst[]>verb-rejected(no-table-in-the-source)>generator>stored");
        result.Definition.Should().Be("он танцевал");
        LastUserText(Models.GeneratorModel).Should().Be($"Georgian word: {form}\nSuggested lemma: {Dance}");
        LastUserText(Models.ReviewerModel).Should().Contain($"Matched to: {form} — aorist, he/she.");
        (await Provenance(Dance))!.LemmaInLexicon.Should().BeFalse();
    }

    // ── The reviewer says no ─────────────────────────────────────────────────────────────────────

    [Test]
    public async Task Rejected_record_is_repaired_once_and_stored_when_the_second_review_approves()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        // The first record has a cell of another verb in it (still a catalog form, not invented Georgian).
        var wrong = Form(CatalogVerb(Write), "aorist", 0);
        var records = new Queue<string>([Record((t, p) => (t, p) == ("aorist", 0) ? wrong : Form(DanceVerb, t, p)), Record()]);
        Models.GeneratorModel.Respond = (_, _) => Task.FromResult(new ChatMessage(ChatRole.Assistant, records.Dequeue()));
        var reviews = new Queue<string>([Reject($"aorist, I: {wrong} is a form of another verb"), Approve]);
        Models.ReviewerModel.Respond = (_, _) => Task.FromResult(new ChatMessage(ChatRole.Assistant, reviews.Dequeue()));

        var result = await Translate("танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Dance);
        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+repair");
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((2, 2));
        var repair = LastUserText(Models.GeneratorModel);
        repair.Should().Contain("Your previous record:").And.Contain(wrong);
        repair.Should().Contain($"Problems found:\n- aorist, I: {wrong} is a form of another verb");
        (await Provenance(Dance))!.RepairRounds.Should().Be(1);
        var forms = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.Where(f => f.Verb.Lemma == Dance).Select(f => f.Form).ToListAsync());
        forms.Should().NotContain(wrong, because: "only the approved record is stored");
    }

    [Test]
    public async Task Record_rejected_twice_is_dropped_and_the_text_is_translated_the_plain_way()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.GeneratorModel.AnswerWith(Record());
        Models.ReviewerModel.AnswerWith(Reject("this lemma is not the verb for the gloss"));

        var result = await Translate("танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("lexicon-no-table>generator>rejected(reviewer)+repair>legacy");
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((2, 2), because: "one repair round, never a second");
        (await StoredVerb(Dance)).Should().BeNull();
        (await Provenance(Dance)).Should().BeNull();

        // The verdict is remembered with the plain translation: the same text costs nothing again.
        var calls = Models.ModelCalls;
        (await Translate("танцевать")).Should().Be(result);
        Models.ModelCalls.Should().Be(calls);
        Log.Paths.Last().Should().Be("cache");
    }

    // ── Hard gates in code: not a matter of anyone's opinion ─────────────────────────────────────

    [TestCase("latin", "one Georgian word in Georgian script", TestName = "Cell_in_latin_is_sent_back_by_the_gate")]
    [TestCase("five", "exactly six cells", TestName = "Row_of_five_cells_is_sent_back_by_the_gate")]
    [TestCase("lemma", "must be the lemma itself", TestName = "Present_without_the_lemma_is_sent_back_by_the_gate")]
    [TestCase("russian-forms", "russianForms.present must have six personal forms", TestName = "Broken_russian_forms_are_sent_back_by_the_gate")]
    public async Task Record_that_fails_a_hard_gate_never_reaches_the_reviewer(string defect, string problem)
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        var bad = JsonNode.Parse(Record())!;
        switch (defect)
        {
            case "latin": bad["tenses"]!["future"]![1] = "itsekvebs"; break;
            case "five": bad["tenses"]!["optative"]!.AsArray().RemoveAt(5); break;
            case "lemma": bad["tenses"]!["present"]![2] = Form(DanceVerb, "present", 0); break;
            case "russian-forms": bad["russianForms"]!["present"]!.AsArray().RemoveAt(0); break;
        }

        Models.GeneratorModel.AnswerWith(bad.ToJsonString());
        Models.ReviewerModel.AnswerWith(Approve);

        var result = await Translate("танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("lexicon-no-table>generator>rejected(gates)+repair>legacy");
        Models.GeneratorModel.Calls.Should().Be(2);
        Models.ReviewerModel.Calls.Should().Be(0, because: "a record that fails a gate is not offered for approval");
        LastUserText(Models.GeneratorModel).Should().Contain(problem);
        (await StoredVerb(Dance)).Should().BeNull();
    }

    [Test]
    public async Task Georgian_word_that_is_not_among_the_written_forms_is_a_gate_failure_even_if_the_reviewer_would_approve()
    {
        await SeedCatalogWithout(Dance);
        var foreign = Form(CatalogVerb(Write), "aorist", 0);
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.Where(v => v.Lemma == Write).ToListAsync());
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith("""{"outcome":"none"}""");
        Models.GeneratorModel.AnswerWith(Record());
        Models.ReviewerModel.AnswerWith(Approve);

        await Translate(foreign);

        Log.Paths.Single().Should().Contain("generator>rejected(gates)+repair>legacy");
        Models.ReviewerModel.Calls.Should().Be(0);
        (await StoredVerb(Dance)).Should().BeNull();
    }

    [Test]
    public async Task Cell_the_generator_is_not_sure_of_is_left_empty_and_the_verb_is_stored_without_it()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.GeneratorModel.AnswerWith(Record((t, p) => (t, p) == ("optative", 4) ? null : Form(DanceVerb, t, p)));
        Models.ReviewerModel.AnswerWith(Approve);

        await Translate("танцевать");

        var card = JsonNode.Parse((await StoredVerb(Dance))!.CardJson)!;
        card["tenses"]!["optative"]!.AsArray().Should().HaveCount(6);
        card["tenses"]!["optative"]![4]!.AsArray().Should().BeEmpty(because: "a missing cell is fine, a guessed one is not");
        LastUserText(Models.ReviewerModel).Should().Contain("—");
        (await Provenance(Dance))!.FormsTotal.Should().Be(35);
    }

    // ── Verdicts that are not a verb ─────────────────────────────────────────────────────────────

    [Test]
    public async Task Made_up_verb_is_not_a_word_only_when_the_strong_model_and_the_dictionary_agree()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"глокать"}""");
        Models.AnalystModel.AnswerWith("""{"outcome":"none"}""");
        Models.GeneratorModel.AnswerWith("""{"verdict":"notAWord"}""");
        External.Fails = true;

        (await Translate("глокать")).Should().BeOfType<TranslationResult.NotTranslatable>();

        Log.Paths.Should().Equal("analyst[]>verb-rejected(analyst-found-no-verb)>generator>not-a-word>not-translatable");
        Models.ReviewerModel.Calls.Should().Be(0);
        (await CacheEntries()).Should().ContainSingle().Which.Source.Should().Be(TranslationCache.SourceNotTranslatable);

        var calls = Models.ModelCalls;
        (await Translate("глокать")).Should().BeOfType<TranslationResult.NotTranslatable>();
        Models.ModelCalls.Should().Be(calls);
        Log.Paths.Last().Should().Be("cache");
    }

    [Test]
    public async Task Strong_model_alone_cannot_refuse_a_word_the_dictionary_knows()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"глокать"}""");
        Models.AnalystModel.AnswerWith("""{"outcome":"none"}""");
        Models.GeneratorModel.AnswerWith("""{"verdict":"notAWord"}""");

        var result = await Translate("глокать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Single().Should().EndWith("generator>not-a-word>not-translatable-but-in-dictionary>legacy");
    }

    [Test]
    public async Task Word_wrongly_sent_down_the_verb_path_still_ends_with_the_old_translation()
    {
        await SeedCatalogWithout();
        // The classifier took a noun for a verb; nobody down the path finds a verb in it.
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":null}""");
        Models.AnalystModel.AnswerWith("""{"outcome":"none"}""");
        Models.GeneratorModel.AnswerWith("""{"verdict":"notAVerb"}""");

        var result = await Translate("рой");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("analyst[]>verb-rejected(analyst-found-no-verb)>generator>not-a-verb>legacy");
        External.Trail.Should().Equal("dictionary:рой");
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbProvenances.CountAsync())).Should().Be(0);
    }

    [Test]
    public async Task Generator_that_fails_leaves_the_old_translation_and_the_text_is_asked_about_again_later()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.GeneratorModel.Respond = (_, _) => throw new InvalidOperationException("provider is down");

        var result = await Translate("танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("lexicon-no-table>generator-failed>legacy");
        (await CacheEntries()).Should().ContainSingle().Which.Classified.Should().BeFalse();
    }

    [Test]
    public async Task Without_the_two_generation_roles_a_verb_with_no_table_is_just_translated()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Models.CanGenerate = false;
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);

        var result = await Translate("танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("lexicon-no-table>legacy");
    }

    [Test]
    public async Task One_more_russian_word_for_a_verb_already_written_adds_a_gloss_with_no_model_but_the_classifier()
    {
        await SeedCatalogWithout(Dance);
        Lexicon.Verbs.Add(new LexiconVerb(Dance, null, HasTable: false, ["to dance"], ["танцевать", "плясать"]));
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.GeneratorModel.AnswerWith(Record());
        Models.ReviewerModel.AnswerWith(Approve);
        await Translate("танцевать");
        var calls = (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls);

        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"плясать"}""");
        var result = await Translate("плясать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Dance);
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be(calls, because: "the lexicon gives the word for a stored verb");
        (await StoredVerb(Dance))!.Translation.Should().Be("танцевать, плясать");
        Log.Paths.Last().Should().Be("lexicon-no-table>generator>existing");
    }

    // ── A full citizen ───────────────────────────────────────────────────────────────────────────

    [Test]
    public async Task Model_made_verb_is_listed_for_revision_with_what_its_approval_rested_on()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Lexicon.Attested = [Dance];
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.GeneratorModel.AnswerWith(Record());
        Models.ReviewerModel.AnswerWith(Approve);
        await Translate("танцевать");

        var listed = await InScope(sp => sp.GetRequiredService<ModelMadeVerbsQuery>().ExecuteAsync(onlyUnrevised: true, CancellationToken.None));

        var row = listed.Should().ContainSingle().Subject;
        row.Lemma.Should().Be(Dance);
        row.Translation.Should().Be("танцевать");
        (row.GeneratorModel, row.ReviewerModel).Should().Be(("gpt-6-astra", "gpt-6-sol"));
        (row.FormsTotal, row.FormsAttested).Should().Be((36, 1));
        row.UnattestedForms.Should().HaveCount(35);
        row.ReviewerReasons.Should().ContainSingle();
        row.RevisedAtUtc.Should().BeNull();

        // Revised verbs drop out of the "to do" list but stay in the full one.
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            (await db.VerbProvenances.SingleAsync()).RevisedAtUtc = DateTime.UtcNow;
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        (await InScope(sp => sp.GetRequiredService<ModelMadeVerbsQuery>().ExecuteAsync(true, CancellationToken.None))).Should().BeEmpty();
        (await InScope(sp => sp.GetRequiredService<ModelMadeVerbsQuery>().ExecuteAsync(false, CancellationToken.None))).Should().ContainSingle();
    }

    [Test]
    public async Task Model_made_verb_is_learned_in_sessions_like_any_other()
    {
        await SeedCatalogWithout(Dance);
        LexiconKnowsDanceWithoutATable();
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.GeneratorModel.AnswerWith(Record((t, p) => (t, p) == ("optative", 4) ? null : Form(DanceVerb, t, p)));
        Models.ReviewerModel.AnswerWith(Approve);
        await Translate("танцевать");
        var now = DateTime.UtcNow;
        var user = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var created = Create.User(Random.Shared.NextInt64(1, long.MaxValue), "Learner");
            db.Users.Add(created);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = created.Id, CurrentLanguage = Language.Georgian });
            await db.SaveChangesAsync(CancellationToken.None);
            return created;
        });

        var before = await InScope(sp => sp.GetRequiredService<VerbLearningService>().GetAsync(user, Dance, 0, now, CancellationToken.None));
        before!.Progress.CanLearn.Should().BeTrue();
        before.Progress.Total.Should().Be(35, because: "the empty cell is not a form to learn");
        before.Level.Should().Be(VerbLevel.New);

        var report = new VerbSessionReport(
            Guid.NewGuid(), """{"scenes":[{"type":"meet"}]}""", 0, 3,
            [new VerbFormStep("present", 0, 3, 0, now), new VerbFormStep("aorist", 0, 3, 0, now), new VerbFormStep("optative", 4, 3, 0, now)],
            Finished: true, ["meet"], StoryCompleted: false, ExamAsked: 0, ExamCorrect: 0);
        var outcome = await InScope(sp => sp.GetRequiredService<VerbLearningService>().SaveAsync(user, Dance, report, 0, now, CancellationToken.None));

        outcome.Should().NotBeNull(because: "a session on a model-made verb is accepted");
        outcome!.XpEarned.Should().BeGreaterThan(0);
        outcome.State.Progress.Forms.Select(f => (f.Tense, f.Person)).Should().BeEquivalentTo(
            new[] { ("present", 0), ("aorist", 0) }, because: "a step for the cell the verb does not have is skipped");
        outcome.State.Level.Should().Be(VerbLevel.Recognising);
        outcome.State.Memory.SessionsPlayed.Should().Be(1);

        // And it is one of the learner's verbs.
        var mine = await InScope(sp => sp.GetRequiredService<MyVerbsQuery>().ContinueAsync(user.Id, CancellationToken.None));
        mine.Should().NotBeNull();
    }
}
