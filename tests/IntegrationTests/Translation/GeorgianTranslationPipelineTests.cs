using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation.Cache;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Translation;

/// <summary>
/// The translation ladder end to end: verb base → cache → classifier → analyst with tools →
/// validation and storing → the old translator. Real Postgres, real DI graph, real Microsoft Agent
/// Framework agents running real tools; only the models, Wiktionary and the external translators are fakes.
/// </summary>
public class GeorgianTranslationPipelineTests : TranslationPipelineTestBase
{
    private const string ItIsAVerb = """{"isTranslationRequest":true,"isVerb":true,"language":"ka"}""";
    private const string NotAVerb = """{"isTranslationRequest":true,"isVerb":false,"language":"ru"}""";
    private const string NotATranslation = """{"isTranslationRequest":false,"isVerb":false,"language":"ru"}""";

    /// <summary>The verb whose real Wiktionary page is recorded in the fixture.</summary>
    private static readonly string PaintPage = FakeWiktionaryHandler.Fixture("wiktionary-paint.json");
    private static readonly string Paint = FakeWiktionaryHandler.TitleOf(PaintPage);

    private static string LemmaOf(string russian) =>
        Catalog().Select(v => v!.AsObject()).Single(v => v["ru"]!.GetValue<string>() == russian)["lemma"]!.GetValue<string>();

    private static readonly string Write = LemmaOf("писать");
    private static readonly string Dance = LemmaOf("танцевать");

    private static string Json(object value) => JsonSerializer.Serialize(value);

    // ── 1. The verb base answers first ───────────────────────────────────────────────────────────

    [Test]
    public async Task Form_of_a_verb_in_the_base_is_answered_from_the_database_with_no_model_call()
    {
        await SeedCatalogWithout();
        var verb = CatalogVerb(Write);
        var form = Form(verb, "aorist", 3);

        var result = await Translate(form);

        result.Should().BeOfType<TranslationResult.Success>()
            .Which.Definition.Should().Be(verb["ru"]!.GetValue<string>());
        Models.ModelCalls.Should().Be(0);
        Wiktionary.RequestedPages.Should().BeEmpty();
        External.Calls.Should().Be(0, because: "a verified verb is served from our base, not from an external site");
        Log.Paths.Should().Equal("verb-base");
    }

    [Test]
    public async Task Russian_translation_of_a_verb_in_the_base_is_answered_with_its_masdar_from_the_database()
    {
        await SeedCatalogWithout();
        var verb = CatalogVerb(Write);

        var result = await Translate("Писать");

        result.Should().BeOfType<TranslationResult.Success>()
            .Which.Definition.Should().Be(verb["title"]!.GetValue<string>());
        Models.ModelCalls.Should().Be(0);
        External.Calls.Should().Be(0);
    }

    [Test]
    public async Task Answer_for_a_form_carries_a_real_sentence_with_that_form_when_the_catalog_has_one()
    {
        await SeedCatalogWithout();
        var sentence = CatalogVerb(Write)["sentences"]![0]!;

        var result = await Translate(sentence["form"]!.GetValue<string>());

        result.Should().BeOfType<TranslationResult.Success>().Which.Example
            .Should().Be($"{sentence["ka"]} — {sentence["ru"]}");
    }

    // ── 2. A new verb that Wiktionary has a table for ────────────────────────────────────────────

    [Test]
    public async Task New_verb_with_a_wiktionary_table_is_stored_verified_with_the_paradigm_from_the_source()
    {
        await SeedCatalogWithout(Paint);
        var catalog = CatalogVerb(Paint);
        var form = Form(catalog, "aorist", 0);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.CallToolsThenAnswer(
            [
                ("search_verb_base", new() { ["query"] = form }),
                ("fetch_wiktionary_conjugation", new() { ["page"] = Paint })
            ],
            _ => Json(new { outcome = "wiktionary", lemma = Paint, russian = "Рисовать" }));

        var result = await Translate(form);

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be("рисовать");

        var stored = await StoredVerb(Paint);
        stored.Should().NotBeNull();
        stored!.Status.Should().Be(VerbStatus.Verified);
        stored.Translation.Should().Be("рисовать");
        // Classified at runtime exactly as the catalog script classified the same verb offline.
        stored.Kind.Should().Be(catalog["kind"]!.GetValue<string>());
        stored.Title.Should().Be(catalog["title"]!.GetValue<string>());
        var card = JsonNode.Parse(stored.CardJson)!;
        card["tenses"]!.ToJsonString().Should().Be(catalog["tenses"]!.ToJsonString(), because: "the paradigm is the source's table");
        card["root"]!.GetValue<string>().Should().Be(catalog["root"]!.GetValue<string>());
        card["reason"]!.GetValue<string>().Should().Be(catalog["reason"]!.GetValue<string>());
        card["model"]!.ToJsonString().Should().Be(catalog["model"]!.ToJsonString());
        card["source"]!.GetValue<string>().Should().Be(catalog["source"]!.GetValue<string>());
        card["status"]!.GetValue<string>().Should().Be("verified");

        var parse = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(form, CancellationToken.None));
        parse.Should().Contain(h => h.Lemma == Paint && h.Tense == "aorist" && h.Person == 0);

        Models.ClassifierModel.Calls.Should().Be(1);
        Models.AnalystModel.Calls.Should().Be(3, because: "two tool calls and the final answer");
        Log.Paths.Should().Equal("verb-wiktionary");
        Wiktionary.RequestedPages.Should().Equal(Paint);
        External.Calls.Should().Be(0);
    }

    [Test]
    public async Task Tools_the_analyst_calls_are_real_functions_over_the_base_and_the_source()
    {
        await SeedCatalogWithout(Paint);
        var known = CatalogVerb(Write);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.CallToolsThenAnswer(
            [
                ("search_verb_base", new() { ["query"] = Form(known, "present", 0) }),
                ("fetch_wiktionary_conjugation", new() { ["page"] = Paint })
            ],
            _ => Json(new { outcome = "none" }));

        await Translate(Form(CatalogVerb(Paint), "present", 0));

        var toolResults = FakeChatClient.ToolResults(Models.AnalystModel.Conversations.Last());
        toolResults.Should().HaveCount(2);
        var search = JsonNode.Parse(toolResults[0])!["verbs"]!.AsArray();
        // The form may belong to more than one catalog verb; the most common one comes first.
        search.Should().NotBeEmpty();
        search[0]!["lemma"]!.GetValue<string>().Should().Be(Write);
        search[0]!["tense"]!.GetValue<string>().Should().Be("present");
        var fetched = JsonNode.Parse(toolResults[1])!;
        fetched["found"]!.GetValue<bool>().Should().BeTrue();
        fetched["present"]!.ToJsonString().Should().Be(
            JsonSerializer.Serialize(Enumerable.Range(0, 6).Select(p => Form(CatalogVerb(Paint), "present", p))));
    }

    [Test]
    public async Task Second_request_for_a_stored_verb_is_served_from_the_database_with_no_model_or_http_call()
    {
        await SeedCatalogWithout(Paint);
        var form = Form(CatalogVerb(Paint), "future", 2);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.CallToolsThenAnswer(
            [("fetch_wiktionary_conjugation", new() { ["page"] = Paint })],
            _ => Json(new { outcome = "wiktionary", lemma = Paint, russian = "рисовать" }));
        var first = await Translate(form);
        var callsAfterFirst = Models.ModelCalls;
        var requestsAfterFirst = Wiktionary.RequestedPages.Count;

        var second = await Translate(form);
        var otherFormOfTheSameVerb = await Translate(Form(CatalogVerb(Paint), "present", 5));

        second.Should().Be(first);
        otherFormOfTheSameVerb.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be("рисовать");
        Models.ModelCalls.Should().Be(callsAfterFirst);
        Log.Paths.Should().Equal("verb-wiktionary", "verb-base", "verb-base");
        Wiktionary.RequestedPages.Should().HaveCount(requestsAfterFirst);
        External.Calls.Should().Be(0);
    }

    [Test]
    public async Task Forms_the_model_makes_up_are_ignored_when_the_source_has_a_table()
    {
        await SeedCatalogWithout(Paint);
        var catalog = CatalogVerb(Paint);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        // The model skips the tool and answers from memory, with a paradigm that is another verb's.
        var wrong = Enumerable.Range(0, 6).Select(p => p == 2 ? Paint : Form(CatalogVerb(Write), "present", p)).ToArray();
        Models.AnalystModel.AnswerWith(Json(new
        {
            outcome = "generated", lemma = Paint, russian = "рисовать", generated = new { present = wrong }
        }));

        await Translate(Form(catalog, "present", 0));

        var stored = await StoredVerb(Paint);
        stored!.Status.Should().Be(VerbStatus.Verified);
        JsonNode.Parse(stored.CardJson)!["tenses"]!.ToJsonString().Should().Be(catalog["tenses"]!.ToJsonString());
        Wiktionary.RequestedPages.Should().Equal(new[] { Paint }, because: "the resolver looks at the source itself");
    }

    [Test]
    public async Task Proposal_for_a_verb_the_looked_up_word_is_not_a_form_of_is_rejected()
    {
        await SeedCatalogWithout(Paint, Dance);
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = Paint, russian = "рисовать" }));

        // A form of "to dance" is looked up; the model points at the page of "to paint".
        var result = await Translate(Form(CatalogVerb(Dance), "present", 0));

        (await StoredVerb(Paint)).Should().BeNull();
        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
    }

    // ── 3. A new verb with no table anywhere ─────────────────────────────────────────────────────

    private static object GeneratedFrom(JsonObject verb) => new
    {
        outcome = "generated",
        lemma = verb["lemma"]!.GetValue<string>(),
        russian = verb["ru"]!.GetValue<string>(),
        masdar = verb["title"]!.GetValue<string>(),
        generated = new
        {
            present = Enumerable.Range(0, 6).Select(p => Form(verb, "present", p)),
            future = Enumerable.Range(0, 6).Select(p => Form(verb, "future", p)),
            aorist = Enumerable.Range(0, 6).Select(p => Form(verb, "aorist", p))
        }
    };

    [Test]
    public async Task New_verb_without_a_table_is_stored_generated_and_marked_unverified()
    {
        await SeedCatalogWithout(Dance);
        var verb = CatalogVerb(Dance);
        var form = Form(verb, "aorist", 4);
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        // Wiktionary has no such page in this test; the "model's own" forms are the catalog's.
        Models.AnalystModel.CallToolsThenAnswer(
            [("fetch_wiktionary_conjugation", new() { ["page"] = Dance })],
            _ => Json(GeneratedFrom(verb)));

        var result = await Translate(form);

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be("танцевать");
        var stored = await StoredVerb(Dance);
        stored!.Status.Should().Be(VerbStatus.Generated);
        var card = JsonNode.Parse(stored.CardJson)!;
        card["status"]!.GetValue<string>().Should().Be("generated", because: "the card must say «не проверено» and games must skip it");
        card["source"].Should().BeNull();
        card["tenses"]!.AsObject().Select(t => t.Key).Should().BeEquivalentTo("present", "future", "aorist");
        Log.Paths.Should().Equal("verb-generated");

        var hint = await InScope(sp => sp.GetRequiredService<VerbReplyHintQuery>().FindAsync([form], CancellationToken.None));
        hint!.Status.Should().Be(VerbStatus.Generated);
        var list = await InScope(sp => sp.GetRequiredService<VerbQueries>().ListAsync(CancellationToken.None));
        list.Single(v => v.Lemma == Dance).Status.Should().Be(VerbStatus.Generated);
        list.Where(v => v.Lemma != Dance).Should().OnlyContain(v => v.Status == VerbStatus.Verified);

        Models.AnalystModel.Reset();
        Models.ClassifierModel.Reset();
        (await Translate(form)).Should().Be(result, because: "generated once — served from the database afterwards");
        Models.ModelCalls.Should().Be(0);
    }

    [Test]
    public async Task Generated_verb_with_only_some_tenses_is_special_and_does_not_speak_of_a_source()
    {
        await SeedCatalogWithout(Dance);
        var verb = CatalogVerb(Dance);
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.AnswerWith(Json(new
        {
            outcome = "generated", lemma = Dance, russian = "танцевать",
            generated = new { present = Enumerable.Range(0, 6).Select(p => Form(verb, "present", p)) }
        }));

        await Translate(Form(verb, "present", 0));

        var stored = await StoredVerb(Dance);
        stored!.Status.Should().Be(VerbStatus.Generated);
        stored.Kind.Should().Be("special", because: "with a part of the tenses nothing can be said about the scheme — as in the catalog");
        JsonNode.Parse(stored.CardJson)!["reason"]!.GetValue<string>().Should().Be("Известна только часть времён — учить формы целиком.");
    }

    [Test]
    public async Task Wiktionary_page_titled_by_a_form_other_than_the_present_is_not_stored_as_a_verb()
    {
        await SeedCatalogWithout(Paint);
        var future = Form(CatalogVerb(Paint), "future", 2);
        // The real page of the verb, served under the title of its future form.
        Wiktionary.Pages[future] = PaintPage;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = future, russian = "рисовать" }));

        await Translate(future);

        (await StoredVerb(future)).Should().BeNull();
        (await StoredVerb(Paint)).Should().BeNull();
        Log.Paths.Should().Equal("verb-rejected>legacy");
    }

    [Test]
    public async Task Generated_forms_that_are_not_georgian_script_are_rejected_and_nothing_is_stored()
    {
        await SeedCatalogWithout(Dance);
        var verb = CatalogVerb(Dance);
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.AnswerWith(Json(new
        {
            outcome = "generated",
            lemma = Dance,
            russian = "танцевать",
            generated = new { present = new[] { "vtsekvav", "tsekvav", Dance, "vtsekvavt", "tsekvavt", "tsekvaven" } }
        }));

        var result = await Translate(Form(verb, "present", 2));

        (await StoredVerb(Dance)).Should().BeNull();
        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        External.Calls.Should().Be(1);
        Log.Paths.Should().Equal("verb-rejected>legacy");
    }

    [TestCase("""{"outcome":"generated","lemma":"LEMMA","russian":"танцевать","generated":{"present":["LEMMA","LEMMA","LEMMA"]}}""",
        TestName = "Generated_paradigm_with_three_persons_instead_of_six_is_rejected")]
    [TestCase("""{"outcome":"generated","lemma":"LEMMA","russian":"to dance","generated":{"present":["LEMMA","LEMMA","LEMMA","LEMMA","LEMMA","LEMMA"]}}""",
        TestName = "Translation_that_is_not_russian_is_rejected")]
    [TestCase("""{"outcome":"generated","lemma":"LEMMA","russian":"танцевать","generated":null}""",
        TestName = "Generated_outcome_without_forms_is_rejected")]
    [TestCase("""{"outcome":"wiktionary","lemma":"LEMMA","russian":"танцевать"}""",
        TestName = "Claim_of_a_wiktionary_table_that_does_not_exist_is_rejected")]
    [TestCase("""{"outcome":"existing","lemma":"LEMMA"}""",
        TestName = "Claim_that_an_absent_verb_is_in_the_base_is_rejected")]
    [TestCase("""{"outcome":"none"}""", TestName = "Analyst_that_cannot_identify_the_verb_stores_nothing")]
    [TestCase("this is not json", TestName = "Analyst_output_that_is_not_json_falls_back")]
    public async Task Bad_proposal_falls_back_to_the_old_translator(string analystAnswer)
    {
        await SeedCatalogWithout(Dance);
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.AnswerWith(analystAnswer.Replace("LEMMA", Dance));

        var result = await Translate(Form(CatalogVerb(Dance), "present", 2));

        (await StoredVerb(Dance)).Should().BeNull();
        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
    }

    // ── 4. Retrieval through the agent: a Russian form, a typo ───────────────────────────────────

    [Test]
    public async Task Inflected_russian_word_is_tied_to_a_verb_of_the_base_and_then_served_from_the_cache()
    {
        await SeedCatalogWithout();
        var verb = CatalogVerb(Write);
        var heWrote = Form(verb, "aorist", 2);
        Models.ClassifierModel.AnswerWith(ItIsAVerb.Replace("ka", "ru"));
        Models.AnalystModel.CallToolsThenAnswer(
            [("search_verb_base", new() { ["query"] = "писал" })],
            results => Json(new
            {
                // The lemma is taken from what the search tool returned, as a model would.
                outcome = "existing",
                lemma = JsonNode.Parse(results[0])!["verbs"]![0]!["lemma"]!.GetValue<string>(),
                form = heWrote
            }));

        var result = await Translate("писал");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(heWrote);
        var cached = (await CacheEntries()).Should().ContainSingle().Subject;
        cached.Key.Should().Be("писал");
        cached.Source.Should().Be(TranslationCache.SourceVerbAgent);

        Models.ClassifierModel.Reset();
        Models.AnalystModel.Reset();
        (await Translate("Писал!")).Should().Be(result);
        Log.Paths.Should().Equal("verb-existing", "cache");
        Models.ModelCalls.Should().Be(0);
        External.Calls.Should().Be(0);
    }

    [Test]
    public async Task Form_the_analyst_names_must_really_be_a_form_of_that_verb()
    {
        await SeedCatalogWithout();
        var verb = CatalogVerb(Write);
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        // The model ties the Russian word to "to write" but names a form of another verb.
        Models.AnalystModel.AnswerWith(Json(new
        {
            outcome = "existing", lemma = Write, form = Form(CatalogVerb(Dance), "aorist", 2)
        }));

        var result = await Translate("писал");

        result.Should().BeOfType<TranslationResult.Success>()
            .Which.Definition.Should().Be(verb["title"]!.GetValue<string>(), because: "an unconfirmed form is dropped, the verb itself is shown");
    }

    [Test]
    public async Task Search_tool_finds_a_form_with_a_typo_and_a_russian_word_in_another_form()
    {
        await SeedCatalogWithout();
        var form = Form(CatalogVerb(Write), "conditional", 3);
        var withTypo = form.Remove(form.Length / 2, 1);

        var (byTypo, byRussian, nothing) = await InScope(async sp =>
        {
            var search = sp.GetRequiredService<VerbBaseSearch>();
            return (await search.SearchAsync(withTypo, CancellationToken.None),
                await search.SearchAsync("писала", CancellationToken.None),
                await search.SearchAsync("самолет", CancellationToken.None));
        });

        byTypo.Should().Contain(m => m.Lemma == Write && m.Match == "typo" && m.Form == form);
        byTypo.Should().HaveCountLessThanOrEqualTo(5);
        // Several catalog verbs have a gloss that starts like «писала»; the tool promises the closest
        // one first and a handful at most — the agent picks.
        byRussian.Should().HaveCountLessThanOrEqualTo(5).And.OnlyContain(m => m.Match == "similar");
        byRussian[0].Lemma.Should().Be(Write);
        nothing.Should().BeEmpty();
    }

    [Test]
    public async Task Search_tool_returns_every_verb_an_exact_word_belongs_to_most_common_first()
    {
        await SeedCatalogWithout();
        var catalog = Catalog().Select(v => v!.AsObject()).ToList();
        // A form that the catalog lists under more than one verb, found in the catalog itself.
        var owners = catalog
            .SelectMany(v => v["tenses"]!.AsObject().SelectMany(t => t.Value!.AsArray())
                .SelectMany(cell => cell!.AsArray()).Select(f => (Form: f!.GetValue<string>(), Lemma: v["lemma"]!.GetValue<string>())))
            .Distinct()
            .GroupBy(x => x.Form)
            .First(g => g.Count() > 1);
        var expected = catalog.Select(v => v["lemma"]!.GetValue<string>()).Where(l => owners.Any(o => o.Lemma == l)).ToList();

        var (matches, first) = await InScope(async sp =>
        {
            var search = sp.GetRequiredService<VerbBaseSearch>();
            return (await search.SearchAsync(owners.Key, CancellationToken.None),
                await search.FindExactAsync(owners.Key, CancellationToken.None));
        });

        matches.Should().OnlyContain(m => m.Match == "form" && m.Form == owners.Key);
        matches.Select(m => m.Lemma).Should().Equal(expected.Take(5), because: "catalog order is by how common a verb is");
        first!.Lemma.Should().Be(expected[0]);
    }

    [Test]
    public async Task Gloss_with_a_clarification_does_not_answer_the_plain_word()
    {
        await SeedCatalogWithout();
        var catalog = Catalog().Select(v => v!.AsObject()).ToList();
        string Lemma(string ru) => catalog.First(v => v["ru"]!.GetValue<string>() == ru)["lemma"]!.GetValue<string>();

        var (plain, inflected) = await InScope(async sp =>
        {
            var search = sp.GetRequiredService<VerbBaseSearch>();
            return (await search.SearchAsync("входить", CancellationToken.None),
                await search.SearchAsync("входил", CancellationToken.None));
        });

        plain.Should().ContainSingle().Which.Lemma.Should().Be(Lemma("входить"));
        // Both «входить» and «входить (сюда)» are offered for the inflected word, the plain gloss first.
        inflected.Select(m => m.Lemma).Take(2).Should().Equal(Lemma("входить"), Lemma("входить (сюда)"));
    }

    // ── 5. Not a verb, not a translation request ─────────────────────────────────────────────────

    [Test]
    public async Task Request_log_line_names_the_path_and_carries_no_text_but_the_looked_up_word()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotAVerb);

        await Translate("стол");

        Log.Lines.Should().ContainSingle()
            .Which.Should().MatchRegex(@"^Translation of стол: path not-a-verb>legacy, Success, \d+ ms$");
    }

    [Test]
    public async Task Text_that_is_not_a_translation_request_never_reaches_the_analyst()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotATranslation);

        var result = await Translate("привет, как дела?");

        // Today's behaviour: the old translator decides what the user sees.
        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Models.ClassifierModel.Calls.Should().Be(1);
        Models.AnalystModel.Calls.Should().Be(0);

        await Translate("привет, как дела?");
        Models.ClassifierModel.Calls.Should().Be(1, because: "the verdict is remembered with the cached translation");
        Log.Paths.Should().Equal("not-a-translation>legacy", "cache");
        External.Calls.Should().Be(1);
    }

    [Test]
    public async Task Text_the_old_translator_cannot_translate_gets_todays_failure()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotATranslation);
        External.Fails = true;

        var result = await Translate("ъъъ");

        result.Should().BeOfType<TranslationResult.Failure>();
        (await CacheEntries()).Should().BeEmpty(because: "a failure is not cached — the site may answer next time");
    }

    [Test]
    public async Task Plain_word_is_translated_by_the_old_translator_once_and_then_served_from_the_cache()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith(NotAVerb);

        var first = await Translate("Стол");
        var second = await Translate("  стол ");
        var third = await Translate("стол!");

        second.Should().Be(first);
        third.Should().Be(first);
        External.Calls.Should().Be(1);
        Models.ClassifierModel.Calls.Should().Be(1);
        Models.AnalystModel.Calls.Should().Be(0);
        var entry = (await CacheEntries()).Should().ContainSingle().Subject;
        entry.Key.Should().Be("стол");
        entry.Direction.Should().Be(TranslationDirection.RussianToGeorgian);
        entry.Source.Should().Be(TranslationCache.SourceExternal);
        entry.HitCount.Should().Be(2);
        entry.Classified.Should().BeTrue();
    }

    [Test]
    public async Task Long_phrase_goes_to_the_old_translator_without_any_model_call()
    {
        await SeedCatalogWithout();

        await Translate("я хочу пойти домой");

        Models.ModelCalls.Should().Be(0);
        External.Calls.Should().Be(1);
    }

    [Test]
    public async Task Latin_text_goes_to_the_old_translator_without_any_model_call()
    {
        await SeedCatalogWithout();

        await Translate("write");
        await Translate("Write");

        Models.ModelCalls.Should().Be(0);
        External.Calls.Should().Be(1);
        Log.Paths.Should().Equal("legacy", "cache");
    }

    // ── 6. Failures degrade to the old translator ────────────────────────────────────────────────

    [Test]
    public async Task Classifier_error_falls_back_to_the_old_translator_and_the_text_is_asked_about_again_later()
    {
        await SeedCatalogWithout(Paint);
        var form = Form(CatalogVerb(Paint), "present", 0);
        Models.ClassifierModel.Respond = (_, _) => throw new HttpRequestException("429 insufficient_quota");

        var result = await Translate(form);

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        (await CacheEntries()).Should().ContainSingle().Which.Classified.Should().BeFalse();
        Log.Paths.Should().Equal("classifier-failed>legacy");

        // The model is back: the cached text gets its analysis after all.
        Wiktionary.Pages[Paint] = PaintPage;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = Paint, russian = "рисовать" }));

        (await Translate(form)).Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be("рисовать");
        (await StoredVerb(Paint)).Should().NotBeNull();
    }

    [Test]
    public async Task Analyst_that_hangs_is_cut_off_by_the_timeout_and_the_old_translator_answers()
    {
        await SeedCatalogWithout(Paint);
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
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
        (await StoredVerb(Paint)).Should().BeNull();
        (await CacheEntries()).Should().ContainSingle().Which.Classified.Should().BeFalse();
    }

    [Test]
    public async Task Wiktionary_outage_stores_nothing_even_if_the_model_offers_its_own_forms()
    {
        await SeedCatalogWithout(Dance);
        Wiktionary.ThrottleNext = 100;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.AnswerWith(Json(GeneratedFrom(CatalogVerb(Dance))));

        var result = await Translate(Form(CatalogVerb(Dance), "present", 0));

        // "The source did not answer" is not "the source has no table": generated forms need the latter.
        (await StoredVerb(Dance)).Should().BeNull();
        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Wiktionary.RequestedPages.Should().HaveCount(3, because: "one attempt and two retries");
        Log.Paths.Should().Equal("analyst-failed>legacy");
    }

    [Test]
    public async Task Throttled_wiktionary_request_is_retried()
    {
        await SeedCatalogWithout(Paint);
        Wiktionary.Pages[Paint] = PaintPage;
        Wiktionary.ThrottleNext = 1;
        Models.ClassifierModel.AnswerWith(ItIsAVerb);
        Models.AnalystModel.AnswerWith(Json(new { outcome = "wiktionary", lemma = Paint, russian = "рисовать" }));

        await Translate(Form(CatalogVerb(Paint), "present", 0));

        (await StoredVerb(Paint)).Should().NotBeNull();
        Wiktionary.RequestedPages.Should().HaveCount(2);
    }

    // ── 7. The switch is off (no key configured) ─────────────────────────────────────────────────

    [Test]
    public async Task With_the_agent_off_translation_is_the_old_translator_behind_the_cache()
    {
        await SeedCatalogWithout();
        Models.Configured = false;
        var form = Form(CatalogVerb(Write), "present", 0);

        var first = await Translate(form);
        var second = await Translate(form);

        // Even a verb of the base is translated the old way: with the switch off nothing changes but the cache.
        first.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        second.Should().Be(first);
        External.Calls.Should().Be(1);
        Models.ModelCalls.Should().Be(0);
        Wiktionary.RequestedPages.Should().BeEmpty();
        Log.Paths.Should().Equal("legacy", "cache");
        (await CacheEntries()).Should().ContainSingle().Which.Classified.Should().BeFalse();
    }

    [Test]
    public async Task With_the_agent_off_a_failure_of_the_old_translator_is_still_a_failure()
    {
        await SeedCatalogWithout();
        Models.Configured = false;
        External.Fails = true;

        (await Translate("стол")).Should().BeOfType<TranslationResult.Failure>();
    }
}
