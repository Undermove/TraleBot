using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation.Cache;
using Application.Translation.Pipeline;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace IntegrationTests.Translation;

/// <summary>
/// The translation ladder end to end: verb base → cache → open lexicon → classifier → analyst with
/// tools → verification and storing → the old translator. Real Postgres, real DI graph, real Microsoft
/// Agent Framework agents running real tools; only the models, Wiktionary, the lexicon data and the
/// external translators are fakes.
/// </summary>
public class GeorgianTranslationPipelineTests : TranslationPipelineTestBase
{
    private const string AVerb = """{"notTranslatable":false,"isVerb":true,"russianInfinitive":null}""";
    private const string NotAVerb = """{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""";
    private const string NotTranslatable = """{"notTranslatable":true,"isVerb":false,"russianInfinitive":null}""";

    private static string RussianVerb(string infinitive) =>
        JsonSerializer.Serialize(new { notTranslatable = false, isVerb = true, russianInfinitive = infinitive });

    /// <summary>The verb whose real Wiktionary page is recorded in the fixture.</summary>
    private static readonly string PaintPage = FakeWiktionaryHandler.Fixture("wiktionary-paint.json");
    private static readonly string Paint = FakeWiktionaryHandler.TitleOf(PaintPage);

    private static string LemmaOf(string russian) =>
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == russian)["lemma"]!.GetValue<string>();

    private static readonly string Write = LemmaOf("писать");
    private static readonly string Dance = LemmaOf("танцевать");

    private static string Json(object value) => JsonSerializer.Serialize(value);

    /// <summary>A typo: one letter typed twice. (Dropping a letter can give another real form.)</summary>
    private static string Doubled(string form, int at) => form.Insert(at, form[at].ToString());

    private static string Meaning(JsonObject verb, string tense, int person) =>
        verb["meanings"]![tense]![person]!.GetValue<string>();

    private static IEnumerable<string> CardForms(JsonObject verb) =>
        new[] { "present", "future", "aorist" }.SelectMany(t => Enumerable.Range(0, 6).Select(p => Form(verb, t, p)));

    /// <summary>The analyst names the verb and says the source has no table for it.</summary>
    private static object NoTableFor(JsonObject verb) => new
    {
        outcome = "noTable", lemma = verb["lemma"]!.GetValue<string>(), russian = verb["ru"]!.GetValue<string>()
    };

    // What happens to a verb with no table when the generator and the reviewer are configured is in
    // VerbGenerationTests; here those two roles are off, so such a verb is just translated.
    [SetUp]
    public void NoGeneration() => Models.CanGenerate = false;

    private void AnalystFetchesThenAnswers(string page, object answer) =>
        Models.AnalystModel.CallToolsThenAnswer(
            [("fetch_wiktionary_conjugation", new() { ["page"] = page })], _ => Json(answer));

    // ── 1. The verb base answers first — no model, no key, no switch ─────────────────────────────

    [TestCase(true)]
    [TestCase(false)]
    public async Task Form_of_a_catalog_verb_is_translated_as_that_form_from_the_database(bool agentOn)
    {
        await SeedCatalogWithout();
        Models.Configured = agentOn;
        var verb = CatalogVerb(Write);

        var result = await Translate(Form(verb, "aorist", 3));

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Meaning(verb, "aorist", 3));
        Models.ModelCalls.Should().Be(0);
        External.Calls.Should().Be(0, because: "a catalog verb is served from our base, not from an external site");
        Log.Paths.Should().Equal("verb-base");
    }

    [Test]
    public async Task Russian_infinitive_of_a_catalog_verb_is_answered_with_its_dictionary_form_with_the_agent_off()
    {
        await SeedCatalogWithout();
        Models.Configured = false;

        var result = await Translate("Писать");

        // The lemma is a real form in the index, so the reply gets its parse and the dictionary entry
        // opens the verb view; the name of the action goes next to it.
        var answer = result.Should().BeOfType<TranslationResult.Success>().Subject;
        answer.Definition.Should().Be(Write);
        answer.AdditionalInfo.Should().Contain($"название действия: {CatalogVerb(Write)["title"]!.GetValue<string>()}");
        External.Calls.Should().Be(0);
        Log.Paths.Should().Equal("verb-base");
    }

    // What the learner typed → the cell of «писать» that answers it. Imperfect before aorist: both say «писал(а)».
    [TestCase("писал", "imperfect", 2, TestName = "Bare_russian_past_is_answered_with_the_he_form")]
    [TestCase("писала", "imperfect", 2, TestName = "Feminine_russian_past_is_answered_with_the_he_she_form")]
    [TestCase("я писал", "imperfect", 0, TestName = "Russian_past_with_a_pronoun_is_exact")]
    [TestCase("она писала", "imperfect", 2, TestName = "She_wrote_is_the_third_person")]
    [TestCase("мы писали", "imperfect", 3, TestName = "Plural_with_a_pronoun_is_exact")]
    [TestCase("пишу", "present", 0, TestName = "Russian_present_shows_its_person")]
    [TestCase("ты пишешь", "present", 1, TestName = "Russian_present_with_a_pronoun")]
    [TestCase("я буду писать", "future", 0, TestName = "Russian_compound_future")]
    [TestCase("мне надо писать", "optative", 0, TestName = "Dative_pronoun_before_nado_is_who_acts")]
    [TestCase("он писал мне", "imperfect", 2, TestName = "Object_pronoun_after_the_verb_is_set_aside")]
    [TestCase("ему писали", "imperfect", 5, TestName = "Object_pronoun_before_the_verb_is_not_who_acts")]
    [TestCase("я пишу тебе", "present", 0, TestName = "Object_pronoun_after_a_present_form")]
    public async Task Russian_verb_form_is_answered_from_the_database_with_no_model(string typed, string tense, int person)
    {
        await SeedCatalogWithout();
        Models.Configured = false;
        var verb = CatalogVerb(Write);

        var result = await Translate(typed);

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Form(verb, tense, person));
        External.Calls.Should().Be(0);
        Log.Paths.Should().Equal("verb-base");
    }

    [Test]
    public async Task Other_reading_of_an_ambiguous_russian_past_is_named_next_to_the_answer()
    {
        await SeedCatalogWithout();
        var verb = CatalogVerb(Write);

        var result = (TranslationResult.Success)await Translate("писал");

        result.AdditionalInfo.Should().Contain($"«{Meaning(verb, "imperfect", 2)}»");
        result.AdditionalInfo.Should().Contain($"ещё: {Form(verb, "aorist", 2)}");
    }

    [Test]
    public async Task Object_pronoun_that_is_not_in_the_form_is_named_in_the_reply()
    {
        await SeedCatalogWithout();
        var verb = CatalogVerb(Write);

        var result = (TranslationResult.Success)await Translate("он писал мне");

        result.Definition.Should().Be(Form(verb, "imperfect", 2));
        result.AdditionalInfo.Should().Contain("«он писал»").And.Contain("без «мне»");
    }

    [Test]
    public async Task Verb_base_wins_over_a_stale_cached_translation()
    {
        await SeedCatalogWithout();
        await InScope(async sp =>
        {
            await sp.GetRequiredService<TranslationCache>().StoreAsync(
                "писать", TranslationDirection.RussianToGeorgian, new TranslationResult.Success("old external answer", "", ""),
                TranslationCache.SourceExternal, classified: false, CancellationToken.None);
            return 0;
        });

        var result = await Translate("писать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Write);
        Log.Paths.Should().Equal("verb-base");
    }

    // ── 2. A new verb that Wiktionary has a table for ────────────────────────────────────────────

    [Test]
    public async Task New_verb_with_a_wiktionary_table_is_stored_verified_with_the_paradigm_from_the_source()
    {
        await SeedCatalogWithout(Paint);
        var catalog = CatalogVerb(Paint);
        var form = Form(catalog, "aorist", 0);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(AVerb);
        AnalystFetchesThenAnswers(Paint, new { outcome = "wiktionary", lemma = Paint, russian = "Рисовать" });

        var result = await Translate(form);

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be("рисовать");
        var stored = await StoredVerb(Paint);
        stored!.Status.Should().Be(VerbStatus.Verified);
        stored.Translation.Should().Be("рисовать");
        stored.Kind.Should().Be(catalog["kind"]!.GetValue<string>());
        stored.Title.Should().Be(catalog["title"]!.GetValue<string>());
        var card = JsonNode.Parse(stored.CardJson)!;
        card["tenses"]!.ToJsonString().Should().Be(catalog["tenses"]!.ToJsonString(), because: "the paradigm is the source's table");
        card["source"]!.GetValue<string>().Should().Be(catalog["source"]!.GetValue<string>());
        card["status"]!.GetValue<string>().Should().Be("verified");
        card["verification"]!.GetValue<string>().Should().StartWith("Формы — из таблицы спряжения в Викисловаре.")
            .And.Contain("Перевод подобрала нейросеть");

        Models.ClassifierModel.Calls.Should().Be(1);
        Models.AnalystModel.Calls.Should().Be(2, because: "one tool call and the final answer");
        Wiktionary.RequestedPages.Should().Equal(Paint);
        External.Calls.Should().Be(0);
        Log.Paths.Should().Equal("analyst[fetch_wiktionary_conjugation]>verb-wiktionary");

        // Stored once — served from the database afterwards, any form of it.
        (await Translate(Form(catalog, "present", 5))).Should().BeOfType<TranslationResult.Success>();
        Models.ModelCalls.Should().Be(3);
        Wiktionary.RequestedPages.Should().HaveCount(1);
        Log.Paths.Last().Should().Be("verb-base");
    }

    [Test]
    public async Task Question_tells_the_analyst_what_our_data_already_says_and_its_tool_is_a_real_function()
    {
        await SeedCatalogWithout(Paint);
        var known = CatalogVerb(Write);
        var misspelled = Doubled(Form(known, "conditional", 3), 2);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(AVerb);
        AnalystFetchesThenAnswers(Paint, new { outcome = "none" });

        await Translate(misspelled);

        var conversation = Models.AnalystModel.Conversations.Last();
        var question = conversation.First(m => m.Role == Microsoft.Extensions.AI.ChatRole.User).Text;
        question.Should().StartWith($"Georgian word: {misspelled}");
        question.Should().Contain($"form {Form(known, "conditional", 3)} of the verb {Write}");
        var fetched = JsonNode.Parse(FakeChatClient.ToolResults(conversation).Single())!;
        fetched["found"]!.GetValue<bool>().Should().BeTrue();
        fetched["present"]!.ToJsonString().Should().Be(
            JsonSerializer.Serialize(Enumerable.Range(0, 6).Select(p => Form(CatalogVerb(Paint), "present", p))));
    }

    [Test]
    public async Task Analyst_that_claims_there_is_no_table_is_overruled_by_the_source()
    {
        await SeedCatalogWithout(Paint);
        var catalog = CatalogVerb(Paint);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(AVerb);
        // The analyst claims there is no table; the resolver looks at the source itself.
        Models.AnalystModel.AnswerWith(Json(new { outcome = "noTable", lemma = Paint, russian = "рисовать" }));

        await Translate(Form(catalog, "present", 0));

        var stored = await StoredVerb(Paint);
        stored!.Status.Should().Be(VerbStatus.Verified);
        JsonNode.Parse(stored.CardJson)!["tenses"]!.ToJsonString().Should().Be(catalog["tenses"]!.ToJsonString());
        Wiktionary.RequestedPages.Should().Equal(new[] { Paint }, because: "the resolver looks at the source itself");
    }

    [Test]
    public async Task Wiktionary_page_titled_by_a_form_other_than_the_present_is_not_stored_as_a_verb()
    {
        await SeedCatalogWithout(Paint);
        var future = Form(CatalogVerb(Paint), "future", 2);
        Wiktionary.Pages[future] = PaintPage;
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = future, russian = "рисовать" }));

        await Translate(future);

        (await StoredVerb(future)).Should().BeNull();
        Log.Paths.Should().Equal("analyst[]>verb-rejected(page-is-not-the-present-form)>legacy");
    }

    // ── 3. The open lexicon: a verb found with no model at all ───────────────────────────────────

    [Test]
    public async Task Russian_verb_the_lexicon_translates_is_stored_from_the_source_with_no_model_call()
    {
        await SeedCatalogWithout(Paint);
        Wiktionary.Pages[Paint] = PaintPage;
        Lexicon.Verbs.Add(new LexiconVerb(Paint, null, HasTable: true, ["to paint"], ["рисовать", "красить"]));

        var result = await Translate("рисовать");

        result.Should().BeOfType<TranslationResult.Success>()
            .Which.Definition.Should().Be(Paint);
        var stored = await StoredVerb(Paint);
        stored!.Status.Should().Be(VerbStatus.Verified);
        stored.Translation.Should().Be("рисовать, красить");
        JsonNode.Parse(stored.CardJson)!["verification"]!.GetValue<string>().Should().Contain("Перевод сверен с русским Викисловарём.");
        Models.ModelCalls.Should().Be(0);
        Log.Paths.Should().Equal("lexicon>verb-wiktionary");

        // An inflected form: the cheap model names the infinitive, the base has the verb — no analyst.
        Models.ClassifierModel.AnswerWith(RussianVerb("рисовать"));
        var inflected = await Translate("рисовал");
        inflected.Should().BeOfType<TranslationResult.Success>()
            .Which.Definition.Should().Be(Paint);
        Models.AnalystModel.Calls.Should().Be(0);
        Log.Paths.Last().Should().Be("verb-base-by-infinitive");

        // And the same inflected form again: from the cache.
        await Translate("Рисовал");
        Models.ClassifierModel.Calls.Should().Be(1);
        Log.Paths.Last().Should().Be("cache");
    }

    [Test]
    public async Task Proposal_outside_the_lexicons_candidates_is_sent_back_once_with_the_discrepancy()
    {
        await SeedCatalogWithout(Paint, Dance);
        Wiktionary.Pages[Paint] = PaintPage;
        // Two candidates: the lexicon alone cannot choose, the analyst must — among them.
        Lexicon.Verbs.Add(new LexiconVerb(Paint, null, true, ["to paint"], ["малевать"]));
        Lexicon.Verbs.Add(new LexiconVerb(Dance, null, false, ["to dance"], ["малевать"]));
        Models.ClassifierModel.AnswerWith(RussianVerb("малевать"));
        Models.AnalystModel.Respond = (messages, _) => Task.FromResult(new Microsoft.Extensions.AI.ChatMessage(
            Microsoft.Extensions.AI.ChatRole.Assistant,
            messages.Any(m => m.Text.Contains("Check failed:"))
                ? Json(new { outcome = "wiktionary", lemma = Paint, russian = "малевать" })
                : Json(new { outcome = "existing", lemma = Write })));

        var result = await Translate("малевать");

        result.Should().BeOfType<TranslationResult.Success>();
        (await StoredVerb(Paint))!.Translation.Should().Be("малевать");
        Models.AnalystModel.Calls.Should().Be(2);
        Models.AnalystModel.Conversations.Last().Last().Text.Should()
            .Contain($"The Wiktionary lexicon translates «малевать» with: {Paint}, {Dance}. You proposed {Write}.");
        Log.Paths.Should().Equal(
            "analyst[]>retry(lexicon-translates-the-word-with-another-verb)>analyst[]>verb-wiktionary");
    }

    [Test]
    public async Task Check_that_fails_twice_is_not_retried_again()
    {
        await SeedCatalogWithout(Paint, Dance);
        Lexicon.Verbs.Add(new LexiconVerb(Paint, null, true, ["to paint"], ["малевать"]));
        Lexicon.Verbs.Add(new LexiconVerb(Dance, null, false, ["to dance"], ["малевать"]));
        Models.ClassifierModel.AnswerWith(RussianVerb("малевать"));
        Models.AnalystModel.AnswerWith(Json(new { outcome = "existing", lemma = Write }));

        var result = await Translate("малевать");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Models.AnalystModel.Calls.Should().Be(2, because: "one retry, never a loop");
        Log.Paths.Single().Should().EndWith("verb-rejected(lexicon-translates-the-word-with-another-verb)>legacy");
    }

    // ── 4. The same verb, not a similar one ──────────────────────────────────────────────────────

    [Test]
    public async Task Catalog_verb_with_another_russian_gloss_is_not_the_verb_that_was_asked_for()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(RussianVerb("строчить"));
        // The model settles for a near-synonym that is in the base.
        Models.AnalystModel.AnswerWith(Json(new { outcome = "existing", lemma = Write }));

        var result = await Translate("строчить");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("analyst[]>verb-rejected(catalog-verb-has-another-russian-gloss)>legacy");
        (await CacheEntries()).Should().ContainSingle().Which.Classified.Should().BeTrue();
    }

    [Test]
    public async Task Runtime_verb_named_again_for_another_russian_word_gets_that_gloss()
    {
        await SeedCatalogWithout(Paint);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = Paint, russian = "изображать" }));
        await Translate(Paint);

        Models.ClassifierModel.AnswerWith(RussianVerb("рисовать"));
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = Paint, russian = "рисовать" }));
        var result = await Translate("рисовать");

        result.Should().BeOfType<TranslationResult.Success>()
            .Which.Definition.Should().Be(Paint);
        (await StoredVerb(Paint))!.Translation.Should().Be("изображать, рисовать");
        var callsSoFar = Models.ModelCalls;
        await Translate("рисовать");
        Models.ModelCalls.Should().Be(callsSoFar, because: "the gloss now finds the verb in the base");
    }

    [TestCase("делать красивым", "делать красивым", TestName = "Gloss_that_is_an_infinitive_phrase_is_kept")]
    [TestCase("красота, рисовать", "рисовать", TestName = "Only_infinitives_of_a_gloss_are_kept")]
    public async Task Russian_gloss_written_by_the_model_must_be_infinitives(string written, string stored)
    {
        await SeedCatalogWithout(Paint);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = Paint, russian = written }));

        await Translate(Paint);

        (await StoredVerb(Paint))!.Translation.Should().Be(stored);
    }

    [Test]
    public async Task Unusable_russian_gloss_for_a_verb_that_has_a_table_is_asked_for_once_more_and_never_generated()
    {
        await SeedCatalogWithout(Paint);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.CanGenerate = true; // the generator is a throwing fake: it must not be reached
        Models.ClassifierModel.AnswerWith(AVerb);
        var answers = new Queue<string>([
            Json(new { outcome = "wiktionary", lemma = Paint, russian = "он рисует" }),
            Json(new { outcome = "wiktionary", lemma = Paint, russian = "рисовать" })]);
        Models.AnalystModel.Respond = (_, _) => Task.FromResult(new Microsoft.Extensions.AI.ChatMessage(Microsoft.Extensions.AI.ChatRole.Assistant, answers.Dequeue()));

        await Translate(Paint);

        (await StoredVerb(Paint))!.Translation.Should().Be("рисовать");
        Log.Paths.Should().Equal("analyst[]>retry(russian-gloss-not-an-infinitive)>analyst[]>verb-wiktionary");
        Models.AnalystModel.Conversations.Last().Last().Text.Should().Contain("You wrote: «он рисует»");

        // And when the second answer is no better: the old translation, still no generation.
        await SeedCatalogWithout(Paint);
        Log.Reset();
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = Paint, russian = "он рисует" }));
        await Translate(Paint);
        Log.Paths.Single().Should().EndWith("verb-rejected(russian-gloss-not-an-infinitive)>legacy");
        Models.GeneratorModel.Calls.Should().Be(0);
    }

    // ── 5. A verb with no table anywhere: the analyst's own forms are never stored ───────────────

    [Test]
    public async Task Verb_without_a_table_is_not_stored_from_the_analyst_and_is_translated_the_old_way_when_generation_is_off()
    {
        await SeedCatalogWithout(Dance);
        var verb = CatalogVerb(Dance);
        Models.ClassifierModel.AnswerWith(RussianVerb("танцевать"));
        AnalystFetchesThenAnswers(Dance, NoTableFor(verb));

        var result = await Translate("танцевать");

        (await StoredVerb(Dance)).Should().BeNull();
        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("analyst[fetch_wiktionary_conjugation]>verb-rejected(no-table-in-the-source)>legacy");

        await Translate("танцевать");
        Models.ModelCalls.Should().Be(3, because: "one classifier call and the analyst's two turns — and nothing on the second request");
        Log.Paths.Last().Should().Be("legacy");
    }

    [TestCase("""{"outcome":"wiktionary","lemma":"LEMMA","russian":"танцевать"}""",
        "no-table-in-the-source", TestName = "Claim_of_a_table_that_does_not_exist_is_rejected")]
    [TestCase("""{"outcome":"existing","lemma":"LEMMA"}""",
        "claimed-verb-not-in-base", TestName = "Claim_that_an_absent_verb_is_in_the_base_is_rejected")]
    public async Task Bad_proposal_is_rejected_with_its_reason_in_the_log(string analystAnswer, string reason)
    {
        await SeedCatalogWithout(Dance);
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith(analystAnswer.Replace("LEMMA", Dance));

        var result = await Translate(Dance);

        (await StoredVerb(Dance)).Should().BeNull();
        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal($"analyst[]>verb-rejected({reason})>legacy");
    }

    // ── 6. A misspelled form ─────────────────────────────────────────────────────────────────────

    [Test]
    public async Task Misspelled_form_is_tied_to_its_verb_only_through_a_real_form()
    {
        await SeedCatalogWithout();
        var verb = CatalogVerb(Write);
        var form = Form(verb, "conditional", 3);
        var misspelled = Doubled(form, 2);
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "existing", lemma = Write, form }));

        var result = (TranslationResult.Success)await Translate(misspelled);

        result.Definition.Should().Be("писать");
        result.AdditionalInfo.Should().StartWith($"возможно, это форма {form}");

        // A real form of the verb, but nowhere near what was typed: not a typo of it.
        Models.AnalystModel.AnswerWith(Json(new { outcome = "existing", lemma = Write, form = Write }));
        await Translate(Doubled(form, 4));
        Log.Paths.Last().Should().Be("analyst[]>verb-rejected(word-is-not-a-form-of-the-proposed-verb)>legacy");

        // The same claim with a form of another verb does not hold.
        Models.AnalystModel.AnswerWith(Json(new { outcome = "existing", lemma = Write, form = Form(CatalogVerb(Dance), "aorist", 2) }));
        await Translate(Doubled(form, 3));
        Log.Paths.Last().Should().Be("analyst[]>verb-rejected(word-is-not-a-form-of-the-proposed-verb)>legacy");
    }

    // ── 7. Not something to translate ────────────────────────────────────────────────────────────

    [Test]
    public async Task Gibberish_is_not_sent_to_machine_translation_and_the_verdict_is_remembered()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotTranslatable);
        External.Fails = true; // the dictionary site does not know the text

        var result = await Translate("ываыва");

        result.Should().BeOfType<TranslationResult.NotTranslatable>();
        Log.Paths.Should().Equal("not-translatable");
        (await CacheEntries()).Should().ContainSingle().Which.Source.Should().Be(TranslationCache.SourceNotTranslatable);

        var externalCalls = External.Calls;
        (await Translate("Ываыва!")).Should().BeOfType<TranslationResult.NotTranslatable>();
        Models.ClassifierModel.Calls.Should().Be(1);
        External.Calls.Should().Be(externalCalls);
        Log.Paths.Last().Should().Be("cache");
    }

    [Test]
    public async Task Small_model_alone_cannot_refuse_a_word_the_dictionary_knows()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotTranslatable);

        var result = await Translate("привет");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("not-translatable-but-in-dictionary>legacy");
    }

    [Test]
    public async Task Word_the_classifier_calls_translatable_goes_the_old_way_whatever_the_corpora_say()
    {
        await SeedCatalogWithout();
        Lexicon.Attested = [];
        Models.ClassifierModel.AnswerWith(NotAVerb);
        External.DictionaryMisses.Add(Write + Write);

        // A Georgian word the corpora have never seen and the dictionary site does not know: a rare
        // noun is exactly that. "Not a verb" is all the models say about it — Google answers, as before.
        var result = await Translate(Write + Write);

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.GoogleDefinition);
        Log.Paths.Should().Equal("not-a-verb>legacy");
    }

    [Test]
    public async Task Verb_the_analyst_does_not_know_is_translated_the_old_way_when_generation_is_off()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(RussianVerb("глокать"));
        Models.AnalystModel.AnswerWith(Json(new { outcome = "none" }));

        (await Translate("глокать")).Should().BeOfType<TranslationResult.Success>();

        Log.Paths.Should().Equal("analyst[]>verb-rejected(analyst-found-no-verb)>legacy");
    }

    // ── 8. Plain words: one cheap call, then the cache ───────────────────────────────────────────

    [Test]
    public async Task Plain_word_costs_one_classifier_call_once_and_its_translation_is_never_cached()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotAVerb);

        var first = await Translate("Стол");
        var second = await Translate("  стол ");
        var third = await Translate("стол!");

        second.Should().Be(first);
        third.Should().Be(first);
        External.Calls.Should().Be(3, because: "an answer nobody has checked is asked for again, not served from the cache");
        Models.ClassifierModel.Calls.Should().Be(1);
        Models.AnalystModel.Calls.Should().Be(0);
        var entry = (await CacheEntries()).Should().ContainSingle().Subject;
        entry.Key.Should().Be("стол");
        entry.Source.Should().Be(TranslationCache.SourceNoTranslation, because: "only the verdict is kept");
        entry.Definition.Should().BeEmpty();
        entry.Classified.Should().BeTrue();
        Log.Paths.Should().Equal("not-a-verb>legacy", "legacy", "legacy");
    }

    [Test]
    public async Task Text_nobody_could_translate_does_not_cost_a_model_call_twice()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotAVerb);
        External.Fails = true;

        (await Translate("ъъъ")).Should().BeOfType<TranslationResult.Failure>();
        (await Translate("ъъъ")).Should().BeOfType<TranslationResult.Failure>();

        Models.ClassifierModel.Calls.Should().Be(1, because: "the verdict is remembered even without a translation");
        Log.Paths.Should().Equal("not-a-verb>legacy", "legacy");
        (await CacheEntries()).Should().ContainSingle().Which.Source.Should().Be(TranslationCache.SourceNoTranslation);
    }

    [Test]
    public async Task Request_log_line_names_the_path_the_model_usage_and_no_text_but_the_looked_up_word()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotAVerb);

        await Translate("стол");

        Log.Lines.Should().ContainSingle().Which.Should().MatchRegex(
            @"^Translation of стол: path not-a-verb>legacy, Success, \d+ ms, model calls 1 \(classifier 1x\d+/\d+, analyst 0x0/0, generator 0x0/0, reviewer 0x0/0\)$");
    }

    // ── 9. Failures degrade to the old translator ────────────────────────────────────────────────

    [Test]
    public async Task Classifier_error_falls_back_to_the_old_translator_and_the_text_is_asked_about_again_later()
    {
        await SeedCatalogWithout(Paint);
        var form = Form(CatalogVerb(Paint), "present", 0);
        Models.ClassifierModel.Respond = (_, _) => throw new HttpRequestException("429 insufficient_quota");

        var result = await Translate(form);

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        (await CacheEntries()).Should().BeEmpty();
        Log.Paths.Should().Equal("classifier-failed>legacy");

        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = Paint, russian = "рисовать" }));
        (await Translate(form)).Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be("рисовать");
    }

    [Test]
    public async Task Analyst_that_hangs_is_cut_off_by_the_timeout_and_the_old_translator_answers()
    {
        await SeedCatalogWithout(Paint);
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.Respond = async (_, ct) =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            throw new InvalidOperationException("unreachable");
        };

        var started = DateTime.UtcNow;
        var result = await Translate(Form(CatalogVerb(Paint), "present", 0));

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        (DateTime.UtcNow - started).Should().BeLessThan(TimeSpan.FromSeconds(10), because: "the test timeout is 1 second");
        Log.Paths.Should().Equal("analyst-failed>legacy");
        (await CacheEntries()).Should().BeEmpty();
    }

    [Test]
    public async Task Wiktionary_outage_is_not_taken_for_a_verb_without_a_table()
    {
        await SeedCatalogWithout(Dance);
        Wiktionary.ThrottleNext = 100;
        Models.ClassifierModel.AnswerWith(AVerb);
        Models.AnalystModel.AnswerWith(Json(NoTableFor(CatalogVerb(Dance))));

        await Translate(Form(CatalogVerb(Dance), "present", 0));

        (await StoredVerb(Dance)).Should().BeNull();
        Wiktionary.RequestedPages.Should().HaveCount(3, because: "one attempt and two retries");
        Log.Paths.Should().Equal("analyst[]>analyst-failed>legacy");
    }

    // ── 10. The switch is off; the budget is spent ───────────────────────────────────────────────

    [Test]
    public async Task With_the_agent_off_a_plain_word_is_the_old_translator_every_time()
    {
        await SeedCatalogWithout();
        Models.Configured = false;

        var first = await Translate("стол");
        var second = await Translate("стол");

        second.Should().Be(first);
        External.Calls.Should().Be(2);
        Models.ModelCalls.Should().Be(0);
        (await CacheEntries()).Should().BeEmpty();
        Log.Paths.Should().Equal("legacy", "legacy");
    }

    // ── 11. "What a model said once is stored and never asked again" ─────────────────────────────

    [Test]
    public async Task Second_pass_over_the_same_requests_makes_no_model_call()
    {
        await SeedCatalogWithout(Paint, Dance);
        var paint = CatalogVerb(Paint);
        var dance = CatalogVerb(Dance);
        Wiktionary.Pages[Paint] = PaintPage;
        Lexicon.Verbs.Add(new LexiconVerb(Dance, null, false, ["to dance"], []));
        Lexicon.Attested = CardForms(dance).ToHashSet();
        var requests = new (string Text, string Classifier, string? Analyst, bool SiteKnows)[]
        {
            (Form(paint, "aorist", 1), AVerb, Json(new { outcome = "wiktionary", lemma = Paint, russian = "рисовать" }), true),
            ("рисовала", RussianVerb("рисовать"), null, true),
            ("танцевать", RussianVerb("танцевать"), Json(NoTableFor(dance)), true),
            ("танцевали", RussianVerb("танцевать"), Json(NoTableFor(dance)), true),
            (Doubled(Form(CatalogVerb(Write), "future", 0), 1), AVerb,
                Json(new { outcome = "existing", lemma = Write, form = Form(CatalogVerb(Write), "future", 0) }), true),
            ("строчить", RussianVerb("строчить"), Json(new { outcome = "existing", lemma = Write }), true),
            ("стол", NotAVerb, null, true),
            ("доброе утро", NotAVerb, null, true),
            ("расскажи анекдот", NotTranslatable, null, false),
            ("ываыва", NotTranslatable, null, false),
            ("ъъъ", NotAVerb, null, false),
            ("писал", "unused", null, true),
        };

        var first = new List<TranslationResult>();
        foreach (var (text, classifier, analyst, siteKnows) in requests)
        {
            Models.ClassifierModel.AnswerWith(classifier);
            Models.AnalystModel.Reset();
            if (analyst != null)
            {
                Models.AnalystModel.AnswerWith(analyst);
            }

            External.Fails = !siteKnows;
            first.Add(await Translate(text));
        }

        var callsAfterFirstPass = Models.ClassifierModel.Calls;
        callsAfterFirstPass.Should().Be(11, because: "every new text but the catalog form went to the classifier once");
        Models.ClassifierModel.Reset();
        Models.AnalystModel.Reset();
        var wiktionaryRequests = Wiktionary.RequestedPages.Count;

        // Any user, any later day: the same texts again.
        for (var i = 0; i < requests.Length; i++)
        {
            External.Fails = !requests[i].SiteKnows;
            (await Translate(requests[i].Text)).Should().Be(first[i], $"«{requests[i].Text}» is answered the same");
        }

        Models.ModelCalls.Should().Be(0, because: "a throwing fake would have failed the request otherwise — and none was called");
        Wiktionary.RequestedPages.Should().HaveCount(wiktionaryRequests);
    }
}
