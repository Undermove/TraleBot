using System.Text.Json;
using System.Text.Json.Nodes;
using FluentAssertions;
using Infrastructure.Translation.Wiktionary;

namespace IntegrationTests.Translation;

/// <summary>
/// The parser is a port of <c>scripts/verbs/fetch-wiktionary.mjs</c>. The fixture is the real API
/// response for a catalog verb, at the very revision the catalog was built from — so the port must
/// read out of it exactly what the script put into <c>verbs.json</c>.
/// </summary>
public class WiktionaryVerbParserTests
{
    private static readonly string Fixture = FakeWiktionaryHandler.Fixture("wiktionary-paint.json");
    private static readonly string Lemma = FakeWiktionaryHandler.TitleOf(Fixture);

    private static JsonObject CatalogEntry() =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json")))!["verbs"]!
            .AsArray().Select(v => v!.AsObject()).Single(v => v["lemma"]!.GetValue<string>() == Lemma);

    [Test]
    public void Reads_the_same_paradigm_the_catalog_script_read_from_this_page()
    {
        var catalog = CatalogEntry();

        var page = WiktionaryVerbParser.Parse(Fixture, Lemma)!;

        page.Paradigm.Revid.Should().Be(catalog["revid"]!.GetValue<long>(), because: "the fixture must be the revision the catalog was built from");
        JsonSerializer.SerializeToNode(page.Paradigm.Tenses)!.ToJsonString()
            .Should().Be(catalog["tenses"]!.ToJsonString());
        page.Paradigm.Title.Should().Be(catalog["title"]!.GetValue<string>());
        page.Paradigm.Masdar.Where(m => m != page.Paradigm.Title)
            .Should().Equal(catalog["masdarWithPreverb"].Deserialize<string[]>());
        page.Paradigm.Source.Should().Be(catalog["source"]!.GetValue<string>());
        JsonSerializer.SerializeToNode(page.Paradigm.Alt)!.ToJsonString().Should().Be(catalog["alt"]!.ToJsonString());
    }

    [Test]
    public void Gives_the_model_the_english_senses_to_recognise_the_verb_by()
    {
        var page = WiktionaryVerbParser.Parse(Fixture, Lemma)!;

        page.EnglishGlosses.Should().ContainSingle().Which.Should().Contain("drawing or painting");
    }

    [Test]
    public void Page_that_does_not_exist_is_no_verb()
    {
        WiktionaryVerbParser.Parse(FakeWiktionaryHandler.Fixture("wiktionary-missing.json"), Lemma).Should().BeNull();
    }

    [Test]
    public void Page_without_a_conjugation_table_is_no_verb()
    {
        // The same real page with the tables cut out: a Georgian entry that is not a conjugated verb.
        var response = JsonNode.Parse(Fixture)!;
        var html = response["parse"]!["text"]!.GetValue<string>();
        response["parse"]!["text"] = html.Replace("roa-inflection-table", "some-other-table");

        WiktionaryVerbParser.Parse(response.ToJsonString(), Lemma).Should().BeNull();
    }
}
