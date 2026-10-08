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
/// A generated verb comes with all six main tenses. A record written without some of them is not stored
/// as it is: the generator is asked once more for exactly those tenses (the completion round) and answers
/// each with the forms, with "the verb has no such tense", or with neither; the reviewer then sees the
/// completed record. And the owner's «пересобрать глагол» rebuilds a poor record that is already stored.
/// Real pipeline, real agents, real Postgres; the models answer from scripts. Georgian comes from the
/// curated catalog only: the "generated" verb is a catalog verb taken out of the seeded base.
/// </summary>
public class VerbCompletionTests : TranslationPipelineTestBase
{
    private const long OwnerTelegramId = 309149393;

    private static readonly string[] MainTenses = ["present", "imperfect", "future", "conditional", "aorist", "optative"];

    private const string VerbByInfinitive = """{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""";
    private const string Approve = """{"approve":true,"reasons":["The paradigm is consistent and the lemma is the verb for the gloss."],"missingTenses":[]}""";

    private static readonly string Dance =
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать")["lemma"]!.GetValue<string>();

    private static readonly string Write =
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "писать")["lemma"]!.GetValue<string>();

    private static JsonObject DanceVerb => CatalogVerb(Dance);

    private static string[] Row(string tense) => Enumerable.Range(0, 6).Select(p => Form(DanceVerb, tense, p)).ToArray();

    /// <summary>The record the generator writes on its first pass: the catalog verb with only some of its tenses.</summary>
    private static string Record(params string[] tenses) => JsonSerializer.Serialize(new
    {
        verdict = "verb",
        lemma = Dance,
        masdar = DanceVerb["title"]!.GetValue<string>(),
        russian = "танцевать",
        tenses = tenses.ToDictionary(t => t, Row),
        russianForms = new
        {
            inf = "танцевать",
            present = new[] { "танцую", "танцуешь", "танцует", "танцуем", "танцуете", "танцуют" },
            past = new { m = "танцевал", f = "танцевала", pl = "танцевали" }
        }
    });

    private static object Forms(string tense) => new { tense, forms = Row(tense), noSuchTense = false, reason = (string?)null };

    private static object NoSuchTense(string tense, string reason) => new { tense, forms = (string[]?)null, noSuchTense = true, reason };

    private static object NotSure(string tense) => new { tense, forms = (string[]?)null, noSuchTense = false, reason = "not sure of the forms" };

    private static string Completion(params object[] answers) => JsonSerializer.Serialize(new { tenses = answers });

    private static string Reject(params string[] reasons) => JsonSerializer.Serialize(new { approve = false, reasons });

    private static bool IsCompletionAsk(IReadOnlyList<ChatMessage> messages) =>
        messages.Last(m => m.Role == ChatRole.User).Text.Contains("Missing tenses:");

    /// <summary>The generator: <paramref name="records"/> for the record asks in turn, <paramref name="completion"/> for the completion ask.</summary>
    private void GeneratorWrites(string completion, params string[] records)
    {
        var queue = new Queue<string>(records);
        Models.GeneratorModel.Respond = (messages, _) => Task.FromResult(new ChatMessage(
            ChatRole.Assistant, IsCompletionAsk(messages) ? completion : queue.Count > 1 ? queue.Dequeue() : queue.Peek()));
    }

    private List<string> GeneratorAsks(bool completion) => Models.GeneratorModel.Conversations
        .Where(c => IsCompletionAsk(c) == completion)
        .Select(c => c.Last(m => m.Role == ChatRole.User).Text)
        .ToList();

    private static string LastUserText(FakeChatClient model) => model.Conversations.Last().Last(m => m.Role == ChatRole.User).Text;

    private async Task Arrange()
    {
        await SeedCatalogWithout(Dance);
        Lexicon.Verbs.Add(new LexiconVerb(Dance, DanceVerb["title"]!.GetValue<string>(), HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith(VerbByInfinitive);
        Models.ReviewerModel.AnswerWith(Approve);
    }

    private Task<VerbProvenance?> Provenance() =>
        InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbProvenances.AsNoTracking().FirstOrDefaultAsync(p => p.Verb.Lemma == Dance));

    private async Task<JsonNode> Card() => JsonNode.Parse((await StoredVerb(Dance))!.CardJson)!;

    private static string[] TensesOf(JsonNode card) => card["tenses"]!.AsObject().Select(t => t.Key).ToArray();

    // ── The completion round ─────────────────────────────────────────────────────────────────────

    [Test]
    public async Task Record_with_only_the_present_is_completed_before_review_and_stored_with_all_six_tenses()
    {
        await Arrange();
        GeneratorWrites(
            Completion(Forms("imperfect"), Forms("future"), Forms("conditional"), Forms("aorist"), Forms("optative")),
            Record("present"));

        var result = await Translate("танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Dance);
        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+completion");
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((2, 1));

        // The second ask names exactly what is missing and shows the record so far.
        var ask = GeneratorAsks(completion: true).Should().ContainSingle().Subject;
        ask.Should().StartWith("Russian verb: танцевать");
        ask.Should().Contain($"lemma: {Dance}").And.Contain($"present: {string.Join(" | ", Row("present"))}");
        ask.Should().EndWith("Missing tenses: aorist, imperfect, optative, conditional, future");

        // The reviewer sees the completed record, and which rows came on the second ask.
        var shown = LastUserText(Models.ReviewerModel);
        shown.Should().Contain($"{Form(DanceVerb, "aorist", 0)} «я танцевал(а)»");
        shown.Should().Contain("Added when asked again: aorist, imperfect, optative, conditional, future.");
        shown.Should().NotContain("Missing main tenses");

        // Stored exactly as the catalog has it: a completed verb is not "a verb with a part of the tenses".
        var card = await Card();
        TensesOf(card).Should().BeEquivalentTo(MainTenses);
        foreach (var tense in MainTenses)
        {
            card["tenses"]![tense]!.ToJsonString().Should().Be(DanceVerb["tenses"]![tense]!.ToJsonString());
        }

        card["kind"]!.GetValue<string>().Should().Be(DanceVerb["kind"]!.GetValue<string>());
        card["reason"]!.GetValue<string>().Should().Be(DanceVerb["reason"]!.GetValue<string>());
        card["meanings"]!.ToJsonString().Should().Be(DanceVerb["meanings"]!.ToJsonString());

        var provenance = await Provenance();
        provenance!.MissingTensesJson.Should().Be("[]");
        JsonSerializer.Deserialize<List<string>>(provenance.CompletedTensesJson).Should().BeEquivalentTo(MainTenses.Skip(1));
        provenance.FormsTotal.Should().Be(36);
        provenance.RepairRounds.Should().Be(0);

        // And every tense answers from the table from now on.
        var calls = Models.ModelCalls;
        ((TranslationResult.Success)await Translate(Form(DanceVerb, "future", 3))).Definition.Should().Be("мы будем танцевать");
        Models.ModelCalls.Should().Be(calls);
    }

    [Test]
    public async Task Tense_the_generator_says_the_verb_does_not_have_is_left_out_with_the_reason_and_nothing_is_asked_again()
    {
        await Arrange();
        GeneratorWrites(
            Completion(
                Forms("future"), Forms("conditional"),
                NoSuchTense("aorist", "The verb is defective: speakers use another verb for the completed past."),
                NoSuchTense("optative", "No optative: it is built on the aorist the verb lacks.")),
            Record("present", "imperfect"));

        await Translate("танцевать");

        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+completion");
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((2, 1), because: "a stated absence is an answer, not a reason to ask again");
        GeneratorAsks(completion: true).Single().Should().EndWith("Missing tenses: aorist, optative, conditional, future");

        var card = await Card();
        TensesOf(card).Should().BeEquivalentTo("present", "imperfect", "future", "conditional");
        card["reason"]!.GetValue<string>().Should().Be("У этого глагола есть не все времена — учить формы целиком.");

        var shown = LastUserText(Models.ReviewerModel);
        shown.Should().Contain("Missing main tenses:");
        shown.Should().Contain("- aorist: the author says the verb has no such tense — \"The verb is defective: speakers use another verb for the completed past.\"");

        var provenance = await Provenance();
        var missing = JsonNode.Parse(provenance!.MissingTensesJson)!.AsArray();
        missing.Select(m => (m!["tense"]!.GetValue<string>(), m["why"]!.GetValue<string>())).Should().Equal(
            ("aorist", "verb-lacks-it"), ("optative", "verb-lacks-it"));
        missing[0]!["note"]!.GetValue<string>().Should().StartWith("The verb is defective");
        missing[0]!["reviewerDisagrees"]!.GetValue<bool>().Should().BeFalse();
        JsonSerializer.Deserialize<List<string>>(provenance.CompletedTensesJson).Should().Equal("conditional", "future");
    }

    [Test]
    public async Task Tense_the_generator_is_still_not_sure_of_stays_empty_and_the_reviewers_objection_is_kept_with_the_verb()
    {
        await Arrange();
        GeneratorWrites(
            Completion(Forms("imperfect"), Forms("future"), Forms("conditional"), NotSure("aorist"),
                NoSuchTense("optative", "The verb has no optative.")),
            Record("present"));
        // The reviewer approves what is there and is certain the verb does have an optative.
        Models.ReviewerModel.AnswerWith("""{"approve":true,"reasons":["The rows are correct."],"missingTenses":["optative","present"]}""");

        await Translate("танцевать");

        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((2, 1), because: "what is missing never sends a correct record back");
        var card = await Card();
        TensesOf(card).Should().BeEquivalentTo("present", "imperfect", "future", "conditional");
        card["reason"]!.GetValue<string>().Should().Be(
            "Известна только часть времён — учить формы целиком.", because: "the model did not say the verb lacks the aorist, and the optative is disputed");

        var missing = JsonNode.Parse((await Provenance())!.MissingTensesJson)!.AsArray();
        missing.Select(m => (m!["tense"]!.GetValue<string>(), m["why"]!.GetValue<string>(), m["reviewerDisagrees"]!.GetValue<bool>()))
            .Should().Equal(("aorist", "not-sure", false), ("optative", "verb-lacks-it", true));
        missing[0]!["note"]!.GetValue<string>().Should().Be("not sure of the forms");

        // The list for the owner shows how much of the verb is there and why the rest is not.
        var row = (await InScope(sp => sp.GetRequiredService<ModelMadeVerbsQuery>().ExecuteAsync(false, CancellationToken.None))).Single();
        row.MainTenses.Should().Be(4);
        row.MissingTenses.Select(m => m.Tense).Should().Equal("aorist", "optative");
        row.CompletedTenses.Should().Equal("imperfect", "conditional", "future");
    }

    [Test]
    public async Task Completed_row_the_reviewer_rejects_goes_through_the_one_repair_round_and_is_never_asked_for_again()
    {
        await Arrange();
        // The completion answers the aorist with another verb's row (catalog forms, not invented Georgian).
        var wrong = Enumerable.Range(0, 6).Select(p => Form(CatalogVerb(Write), "aorist", p)).ToArray();
        GeneratorWrites(
            Completion(
                Forms("imperfect"), Forms("future"), Forms("conditional"), Forms("optative"),
                new { tense = "aorist", forms = wrong, noSuchTense = false, reason = (string?)null }),
            Record("present"),
            // The repair: the author takes the unconfirmed row out, as the reviewer told it to.
            Record("present", "imperfect", "future", "conditional", "optative"));
        var reviews = new Queue<string>([Reject("aorist: the row is another verb's; set it to null"), Approve]);
        Models.ReviewerModel.Respond = (_, _) => Task.FromResult(new ChatMessage(ChatRole.Assistant, reviews.Dequeue()));

        await Translate("танцевать");

        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+completion+repair");
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((3, 2), because: "record, completion, repair — and no second completion");
        GeneratorAsks(completion: true).Should().ContainSingle();
        var repair = GeneratorAsks(completion: false).Last();
        repair.Should().Contain("Your previous record:").And.Contain(wrong[0], because: "the repair works on the completed record");
        repair.Should().Contain("Problems found:\n- aorist: the row is another verb's; set it to null");

        var card = await Card();
        TensesOf(card).Should().BeEquivalentTo("present", "imperfect", "future", "conditional", "optative");
        var forms = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.Where(f => f.Verb.Lemma == Dance).Select(f => f.Form).ToListAsync());
        forms.Should().NotContain(wrong);

        var provenance = await Provenance();
        provenance!.RepairRounds.Should().Be(1);
        JsonNode.Parse(provenance.MissingTensesJson)!.AsArray().Single()!["why"]!.GetValue<string>().Should().Be("not-sure");
        JsonSerializer.Deserialize<List<string>>(provenance.CompletedTensesJson).Should().BeEquivalentTo("imperfect", "future", "conditional", "optative");
    }

    private static string RejectRows(string[] tenses, bool restIsRight = true, params string[] reasons) =>
        JsonSerializer.Serialize(new { approve = false, reasons, missingTenses = Array.Empty<string>(), wrongTenses = tenses, restIsRight });

    [Test]
    public async Task Rows_of_the_completion_round_that_the_reviewer_does_not_confirm_are_left_out_at_once_and_the_rest_is_stored()
    {
        await Arrange();
        var wrong = Enumerable.Range(0, 6).Select(p => Form(CatalogVerb(Write), "aorist", p)).ToArray();
        GeneratorWrites(
            Completion(Forms("future"), Forms("conditional"), Forms("optative"),
                new { tense = "aorist", forms = wrong, noSuchTense = false, reason = (string?)null }),
            Record("present", "imperfect"));
        Models.ReviewerModel.AnswerWith(RejectRows(["aorist", "optative"], true, "aorist: these are forms of another verb", "optative: cannot be confirmed"));

        var result = await Translate("танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Dance);
        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+completion+rows-left-out");
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((2, 1), because: "a row of the second ask is stored only if confirmed; no repair round is spent on it");
        var card = await Card();
        TensesOf(card).Should().BeEquivalentTo("present", "imperfect", "future", "conditional");
        card["meanings"]!.AsObject().Select(m => m.Key).Should().BeEquivalentTo("present", "imperfect", "future", "conditional");
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.Where(f => f.Verb.Lemma == Dance).Select(f => f.Form).ToListAsync()))
            .Should().NotContain(wrong);

        var provenance = await Provenance();
        JsonNode.Parse(provenance!.MissingTensesJson)!.AsArray()
            .Select(m => (m!["tense"]!.GetValue<string>(), m["why"]!.GetValue<string>(), m["note"]!.GetValue<string>()))
            .Should().Equal(
                ("aorist", "not-sure", "the reviewer rejected the row the generator gave"),
                ("optative", "not-sure", "the reviewer rejected the row the generator gave"));
        JsonSerializer.Deserialize<List<string>>(provenance.CompletedTensesJson).Should().Equal("conditional", "future");
        provenance.ReviewerReasons.Should().Contain("aorist: these are forms of another verb");
        provenance.FormsTotal.Should().Be(24);
    }

    [Test]
    public async Task Row_of_the_first_pass_rejected_twice_is_left_out_and_the_verb_is_not_lost()
    {
        await Arrange();
        Lexicon.Attested = MainTenses.SelectMany(Row).ToHashSet();
        Models.GeneratorModel.AnswerWith(Record(MainTenses));
        Models.ReviewerModel.AnswerWith(RejectRows(["optative"], true, "optative: the row cannot be confirmed"));

        await Translate("танцевать");

        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+rows-left-out+repair");
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((2, 2), because: "the generator gets its one chance to repair a row it wrote itself");
        TensesOf(await Card()).Should().BeEquivalentTo("present", "imperfect", "future", "conditional", "aorist");
        var provenance = await Provenance();
        provenance!.RepairRounds.Should().Be(1);
        JsonNode.Parse(provenance.MissingTensesJson)!.AsArray().Single()!["tense"]!.GetValue<string>().Should().Be("optative");
        GeneratorAsks(completion: true).Should().BeEmpty(because: "a row taken out on the reviewer's word is not asked for again");
    }

    [TestCase(false, "optative", TestName = "Rejection_that_is_not_only_about_rows_still_drops_the_record")]
    [TestCase(true, "present", TestName = "Rejected_present_row_still_drops_the_record")]
    public async Task Record_is_dropped_when_the_reviewer_does_not_vouch_for_the_rest(bool restIsRight, string tense)
    {
        await Arrange();
        Models.GeneratorModel.AnswerWith(Record(MainTenses));
        Models.ReviewerModel.AnswerWith(RejectRows([tense], restIsRight, "the lemma is not the verb for the gloss"));

        var result = await Translate("танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("lexicon-no-table>generator>rejected(reviewer)+repair>legacy");
        (await StoredVerb(Dance)).Should().BeNull();
    }

    [Test]
    public async Task Georgian_word_whose_row_the_reviewer_rejects_is_not_stored_as_a_verb_without_that_row()
    {
        await SeedCatalogWithout(Dance);
        var form = Form(DanceVerb, "optative", 2);
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":null}""");
        Models.AnalystModel.AnswerWith(JsonSerializer.Serialize(new { outcome = "noTable", lemma = Dance, russian = "танцевать" }));
        Models.GeneratorModel.AnswerWith(Record(MainTenses));
        Models.ReviewerModel.AnswerWith(RejectRows(["optative"], true, "optative: the row cannot be confirmed"));

        await Translate(form);

        Log.Paths.Single().Should().EndWith("generator>rejected(reviewer)+repair>legacy", because: "the word the person asked about would not be in the verb");
        (await StoredVerb(Dance)).Should().BeNull();
    }

    [Test]
    public async Task Completion_row_is_taken_only_when_real_texts_have_at_least_half_of_its_forms()
    {
        await Arrange();
        // The corpora know the first pass, the whole future and half of the conditional; of the aorist — two forms.
        Lexicon.Attested = Row("present").Concat(Row("imperfect")).Concat(Row("future")).Concat(Row("conditional").Take(3)).Concat(Row("aorist").Take(2)).ToHashSet();
        GeneratorWrites(Completion(Forms("future"), Forms("conditional"), Forms("aorist"), NotSure("optative")), Record("present", "imperfect"));

        await Translate("танцевать");

        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+completion");
        TensesOf(await Card()).Should().BeEquivalentTo("present", "imperfect", "future", "conditional");
        LastUserText(Models.ReviewerModel).Should().NotContain("\naorist:", because: "the reviewer is not shown a row that was not taken");
        JsonNode.Parse((await Provenance())!.MissingTensesJson)!.AsArray()
            .Select(m => (m!["tense"]!.GetValue<string>(), m["note"]!.GetValue<string>()))
            .Should().Equal(("aorist", "the forms the generator gave were not found in real texts"), ("optative", "not sure of the forms"));
    }

    [Test]
    public async Task Row_taken_out_in_the_repair_round_is_not_asked_for_again()
    {
        await Arrange();
        var records = new Queue<string>([Record(MainTenses), Record("present", "imperfect", "future", "conditional", "aorist")]);
        Models.GeneratorModel.Respond = (_, _) => Task.FromResult(new ChatMessage(ChatRole.Assistant, records.Dequeue()));
        var reviews = new Queue<string>([Reject("optative: cannot be confirmed; set the row to null"), Approve]);
        Models.ReviewerModel.Respond = (_, _) => Task.FromResult(new ChatMessage(ChatRole.Assistant, reviews.Dequeue()));

        await Translate("танцевать");

        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+repair");
        Models.GeneratorModel.Calls.Should().Be(2, because: "the reviewer had the row removed: asking the generator for it again would undo that");
        TensesOf(await Card()).Should().HaveCount(5);
    }

    [Test]
    public async Task Completed_record_rejected_twice_is_dropped_after_three_generator_calls_and_one_place_in_the_budget()
    {
        await Arrange();
        GeneratorWrites(Completion(Forms("imperfect"), Forms("future"), Forms("conditional"), Forms("aorist"), Forms("optative")), Record("present"));
        Models.ReviewerModel.AnswerWith(Reject("this lemma is not the verb for the gloss"));
        var user = Guid.NewGuid();

        var result = await TranslateAs(user, "танцевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("lexicon-no-table>generator>rejected(reviewer)+completion+repair>legacy");
        (Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((3, 2), because: "the rounds are bounded: one completion, one repair");
        GeneratorAsks(completion: true).Should().ContainSingle(because: "the repaired record came without tenses again and was not asked about again");
        (await StoredVerb(Dance)).Should().BeNull();

        var counters = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().ModelBudgetDays.AsNoTracking().ToListAsync());
        counters.Should().OnlyContain(c => c.Generations == 1, because: "a verb takes one place in the generation budget however many rounds it needs");
    }

    [Test]
    public async Task Completion_that_fails_or_answers_with_a_broken_row_leaves_the_record_as_it_was_written()
    {
        await Arrange();
        var record = Record("present", "imperfect");
        var broken = JsonNode.Parse(Completion(Forms("future"), Forms("conditional"), Forms("aorist"), Forms("optative")))!;
        broken["tenses"]![0]!["forms"]![1] = "itsekvebs";
        broken["tenses"]![1]!["forms"]!.AsArray().RemoveAt(5);
        broken["tenses"]![2]!["tense"] = "present";
        Models.GeneratorModel.Respond = (messages, _) => IsCompletionAsk(messages) && Models.GeneratorModel.Calls == 2
            ? throw new InvalidOperationException("provider is down")
            : Task.FromResult(new ChatMessage(ChatRole.Assistant, IsCompletionAsk(messages) ? broken.ToJsonString() : record));

        await Translate("танцевать");

        // The provider failed on the completion call: the verb is stored with what the first pass gave.
        Log.Paths.Should().Equal("lexicon-no-table>generator>stored+completion");
        TensesOf(await Card()).Should().BeEquivalentTo("present", "imperfect");
        JsonNode.Parse((await Provenance())!.MissingTensesJson)!.AsArray().Select(m => m!["why"]!.GetValue<string>())
            .Should().Equal("not-sure", "not-sure", "not-sure", "not-sure");
        (await Card())["reason"]!.GetValue<string>().Should().Be("Известна только часть времён — учить формы целиком.");

        // The same with an answer that came but is unusable: Latin in a cell, five cells, a tense nobody
        // asked for (it must not overwrite the present). Only the sound row is taken.
        await Arrange();
        await Translate("танцевать");

        var card = await Card();
        TensesOf(card).Should().BeEquivalentTo("present", "imperfect", "optative");
        card["tenses"]!["present"]!.ToJsonString().Should().Be(DanceVerb["tenses"]!["present"]!.ToJsonString());
    }

    [Test]
    public async Task Completion_round_is_skipped_when_it_is_switched_off_or_would_not_fit_in_the_time_one_verb_may_take()
    {
        await Arrange();
        Models.GeneratorModel.AnswerWith(Record("present", "imperfect"));
        Options.GenerationTotalSeconds = Options.ReviewerTimeoutSeconds + 5;

        await Translate("танцевать");

        Log.Paths.Should().Equal("lexicon-no-table>generator>stored");
        Models.GeneratorModel.Calls.Should().Be(1, because: "no time is left for another call of the strong model before the reviewer");
        TensesOf(await Card()).Should().BeEquivalentTo("present", "imperfect");
        JsonNode.Parse((await Provenance())!.MissingTensesJson)!.AsArray().Should().HaveCount(4);

        await Arrange();
        Options.GenerationTotalSeconds = new TranslationAgentOptions().GenerationTotalSeconds;
        Options.CompleteMissingTenses = false;
        await Translate("танцевать");
        Models.GeneratorModel.Calls.Should().Be(2, because: "one call per verb: the round is off");
    }

    // ── «Пересобрать глагол» ─────────────────────────────────────────────────────────────────────

    /// <summary>A poor record in the base: the verb with the present only, as an older generator left it.</summary>
    private async Task<Verb> StorePoorRecord()
    {
        await Arrange();
        Options.CompleteMissingTenses = false;
        Models.GeneratorModel.AnswerWith(Record("present"));
        await Translate("танцую");
        Options.CompleteMissingTenses = true;
        Models.GeneratorModel.Reset();
        Models.ReviewerModel.Reset();
        Models.ReviewerModel.AnswerWith(Approve);
        var verb = await StoredVerb(Dance);
        TensesOf(JsonNode.Parse(verb!.CardJson)!).Should().Equal("present");
        return verb;
    }

    private Task<VerbRegenerationResult> Regenerate(string lemma) =>
        InScope(sp => sp.GetRequiredService<VerbRegenerationService>().ExecuteAsync(lemma, CancellationToken.None));

    [Test]
    public async Task Poor_record_is_rebuilt_with_all_tenses_and_the_learners_keep_their_verb_and_what_they_learned()
    {
        var poor = await StorePoorRecord();
        var now = DateTime.UtcNow;
        var learner = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var user = Create.User(Random.Shared.NextInt64(1, long.MaxValue), "Learner");
            db.Users.Add(user);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
            await db.SaveChangesAsync(CancellationToken.None);
            return user;
        });
        var report = new VerbSessionReport(
            Guid.NewGuid(), """{"scenes":[{"type":"meet"}]}""", 0, 3, [new VerbFormStep("present", 0, 3, 0, now)],
            Finished: true, ["meet"], StoryCompleted: false, ExamAsked: 0, ExamCorrect: 0);
        (await InScope(sp => sp.GetRequiredService<VerbLearningService>().SaveAsync(learner, Dance, report, 0, now, CancellationToken.None)))
            .Should().NotBeNull();
        GeneratorWrites(
            Completion(Forms("imperfect"), Forms("future"), Forms("conditional"), Forms("aorist"), Forms("optative")),
            Record("present"));

        var result = await Regenerate(Dance);

        result.Outcome.Should().Be("replaced");
        (result.MainTensesBefore, result.MainTensesAfter).Should().Be((1, 6));
        result.ChangedForms.Should().BeEmpty();
        result.Missing.Should().BeEmpty();
        LastUserText(Models.GeneratorModel).Should().StartWith("Russian verb: танцевать");
        GeneratorAsks(completion: false).Single().Should().StartWith(
            $"Russian verb: танцевать\nTyped: танцевать\nSuggested lemma: {Dance}\nWiktionary lexicon: ",
            because: "the verb is asked for by the Russian word it is stored under, with its lemma as the hint");

        var rebuilt = await StoredVerb(Dance);
        rebuilt!.Id.Should().Be(poor.Id, because: "the row stays — progress and «мои глаголы» point to it");
        rebuilt.Status.Should().Be(VerbStatus.Generated);
        rebuilt.CreatedAtUtc.Should().BeCloseTo(poor.CreatedAtUtc, TimeSpan.FromMilliseconds(1));
        var card = JsonNode.Parse(rebuilt.CardJson)!;
        TensesOf(card).Should().BeEquivalentTo(MainTenses);
        card["reason"]!.GetValue<string>().Should().Be(DanceVerb["reason"]!.GetValue<string>());
        card["status"]!.GetValue<string>().Should().Be("generated");

        // The form index is rebuilt: every tense now answers from the table, with no model.
        var calls = Models.ModelCalls;
        Log.Reset();
        ((TranslationResult.Success)await Translate(Form(DanceVerb, "aorist", 5))).Definition.Should().Be("они танцевали");
        ((TranslationResult.Success)await Translate("танцую")).Definition.Should().Be(Form(DanceVerb, "present", 0));
        Log.Paths.Should().Equal("verb-base", "verb-base");
        Models.ModelCalls.Should().Be(calls);

        // What the learner had is still theirs.
        var state = await InScope(sp => sp.GetRequiredService<VerbLearningService>().GetAsync(learner, Dance, 0, now, CancellationToken.None));
        state!.Progress.Forms.Select(f => (f.Tense, f.Person)).Should().Equal(("present", 0));
        state.Progress.Total.Should().Be(36);
        state.Memory.SessionsPlayed.Should().Be(1);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().UserVerbs.CountAsync(u => u.VerbId == poor.Id))).Should().Be(1);

        // One provenance row, brought up to date; the request that first led to the verb stays on record.
        var provenances = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbProvenances.AsNoTracking().ToListAsync());
        var provenance = provenances.Should().ContainSingle().Subject;
        provenance.AskedText.Should().Be("танцую");
        provenance.FormsTotal.Should().Be(36);
        provenance.MissingTensesJson.Should().Be("[]");
        var row = (await InScope(sp => sp.GetRequiredService<ModelMadeVerbsQuery>().ExecuteAsync(false, CancellationToken.None))).Single();
        (row.MainTenses, row.Learners).Should().Be((6, 1));
    }

    [Test]
    public async Task Rebuild_that_would_worsen_the_record_or_is_not_approved_leaves_the_stored_one_untouched()
    {
        await Arrange();
        GeneratorWrites(Completion(Forms("future"), Forms("conditional"), NotSure("aorist"), NotSure("optative")), Record("present", "imperfect"));
        await Translate("танцевать");
        var before = await StoredVerb(Dance);
        TensesOf(JsonNode.Parse(before!.CardJson)!).Should().HaveCount(4);

        // Fewer tenses than the stored record has.
        GeneratorWrites(Completion(NotSure("imperfect"), NotSure("future"), NotSure("conditional"), NotSure("aorist"), NotSure("optative")), Record("present"));
        var fewer = await Regenerate(Dance);
        (fewer.Outcome, fewer.Reason).Should().Be(("kept", "fewer-tenses"));
        (fewer.MainTensesBefore, fewer.MainTensesAfter).Should().Be((4, 1));

        // As many tenses, but a hole in a row.
        var holed = JsonNode.Parse(Record("present", "imperfect", "future", "conditional"))!;
        holed["tenses"]!["future"]![4] = null;
        GeneratorWrites(Completion(NotSure("aorist"), NotSure("optative")), holed.ToJsonString());
        (await Regenerate(Dance)).Reason.Should().Be("fewer-tenses");

        // Not approved, twice.
        GeneratorWrites(Completion(), Record(MainTenses));
        Models.ReviewerModel.AnswerWith(Reject("future, I: wrong person marker"));
        var rejected = await Regenerate(Dance);
        (rejected.Outcome, rejected.Reason).Should().Be(("kept", "not-approved"));
        rejected.ReviewerReasons.Should().Contain("future, I: wrong person marker");

        // The generator names another verb.
        var other = JsonNode.Parse(Record(MainTenses))!;
        other["lemma"] = Write;
        other["tenses"]!["present"]![2] = Write;
        GeneratorWrites(Completion(), other.ToJsonString());
        Models.ReviewerModel.AnswerWith(Approve);
        (await Regenerate(Dance)).Reason.Should().Be("another-verb");

        // The strong model fails.
        Models.GeneratorModel.Respond = (_, _) => throw new InvalidOperationException("provider is down");
        (await Regenerate(Dance)).Reason.Should().Be("failed");

        var after = await StoredVerb(Dance);
        after!.CardJson.Should().Be(before.CardJson);
        after.UpdatedAtUtc.Should().Be(before.UpdatedAtUtc);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.CountAsync(f => f.VerbId == before.Id))).Should().Be(24);
    }

    [Test]
    public async Task Curated_verbs_and_unknown_lemmas_are_refused_without_a_model_call_and_the_daily_cap_holds()
    {
        await StorePoorRecord();
        var calls = Models.ModelCalls;

        (await Regenerate(Write)).Outcome.Should().Be("not-model-made");
        (await Regenerate(Form(DanceVerb, "present", 0))).Outcome.Should().Be("not-found");
        Models.ModelCalls.Should().Be(calls, because: "a refusal costs nothing");
        JsonNode.Parse((await StoredVerb(Write))!.CardJson)!["status"]!.GetValue<string>().Should().Be("verified");

        // The rebuild takes a place in the day's generation budget; over the cap nothing is asked.
        Options.MaxGenerationsPerDay = 1;
        (await Regenerate(Dance)).Outcome.Should().Be("over-budget");
        Models.GeneratorModel.Calls.Should().Be(0);

        Models.CanGenerate = false;
        Options.MaxGenerationsPerDay = 0;
        (await Regenerate(Dance)).Outcome.Should().Be("generation-is-off");
    }

    // ── The owner's endpoint ─────────────────────────────────────────────────────────────────────

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

    private async Task<(HttpStatusCode Status, JsonNode? Body)> Admin(HttpMethod method, string path, long telegramId, object? body = null)
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
    public async Task Owner_rebuilds_a_poor_verb_from_the_list_and_nobody_else_can()
    {
        await StorePoorRecord();
        GeneratorWrites(
            Completion(Forms("imperfect"), Forms("future"), Forms("conditional"), Forms("aorist"), NoSuchTense("optative", "The verb has no optative.")),
            Record("present"));

        var listed = await Admin(HttpMethod.Get, "verbs/model-made", OwnerTelegramId);
        listed.Status.Should().Be(HttpStatusCode.OK);
        var row = listed.Body!["verbs"]!.AsArray().Single()!;
        row["mainTenses"]!.GetValue<int>().Should().Be(1);
        row["missingTenses"]!.AsArray().Should().HaveCount(5, because: "the list shows a poor record as poor");

        (await Admin(HttpMethod.Post, "verbs/regenerate", 777001, new { lemma = Dance })).Status.Should().Be(HttpStatusCode.NotFound);
        Models.GeneratorModel.Calls.Should().Be(0);
        (await Admin(HttpMethod.Post, "verbs/regenerate", OwnerTelegramId, new { lemma = "dance" })).Status.Should().Be(HttpStatusCode.BadRequest);
        (await Admin(HttpMethod.Post, "verbs/regenerate", OwnerTelegramId, new { lemma = Write })).Status.Should().Be(HttpStatusCode.Conflict);

        var rebuilt = await Admin(HttpMethod.Post, "verbs/regenerate", OwnerTelegramId, new { lemma = Dance });

        rebuilt.Status.Should().Be(HttpStatusCode.OK);
        rebuilt.Body!["outcome"]!.GetValue<string>().Should().Be("replaced");
        (rebuilt.Body["mainTensesBefore"]!.GetValue<int>(), rebuilt.Body["mainTensesAfter"]!.GetValue<int>()).Should().Be((1, 5));
        rebuilt.Body["missing"]!.AsArray().Single()!["why"]!.GetValue<string>().Should().Be("verb-lacks-it");

        row = (await Admin(HttpMethod.Get, "verbs/model-made", OwnerTelegramId)).Body!["verbs"]!.AsArray().Single()!;
        row["mainTenses"]!.GetValue<int>().Should().Be(5);
        row["missingTenses"]!.AsArray().Single()!["note"]!.GetValue<string>().Should().Be("The verb has no optative.");
        row["completedTenses"]!.AsArray().Should().HaveCount(4);
    }
}
