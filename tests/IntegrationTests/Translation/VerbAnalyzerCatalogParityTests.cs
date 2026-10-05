using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Verbs;
using FluentAssertions;

namespace IntegrationTests.Translation;

/// <summary>
/// <see cref="VerbAnalyzer"/> is a port of <c>scripts/verbs/analyze.mjs</c>, and the catalog
/// <c>verbs.json</c> is that script's output. Every catalog verb must get from the port exactly what
/// the script stored — otherwise a verb added at runtime would be classified differently from the
/// same verb added through the catalog.
/// </summary>
public class VerbAnalyzerCatalogParityTests
{
    private static IEnumerable<TestCaseData> CatalogVerbs() =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json")))!["verbs"]!
            .AsArray()
            .Select(v => new TestCaseData(v!.ToJsonString()).SetArgDisplayNames(v!["ru"]!.GetValue<string>()));

    [TestCaseSource(nameof(CatalogVerbs))]
    public void Port_gives_the_catalog_verb_the_classification_stored_in_the_catalog(string verbJson)
    {
        var verb = JsonNode.Parse(verbJson)!;
        var tenses = verb["tenses"].Deserialize<Dictionary<string, string[][]>>()!;

        var analysis = VerbAnalyzer.Analyze(verb["lemma"]!.GetValue<string>(), tenses);

        analysis.Kind.Should().Be(verb["kind"]!.GetValue<string>());
        analysis.Root.Should().Be(verb["root"]!.GetValue<string>());
        analysis.OddTenses.Should().Equal(verb["oddTenses"].Deserialize<string[]>());
        analysis.Reason.Should().Be(verb["reason"]!.GetValue<string>());
    }

    [Test]
    public void Catalog_is_not_empty_so_the_parity_cases_actually_ran()
    {
        CatalogVerbs().Should().HaveCountGreaterThan(20);
    }

    [Test]
    public void Verb_with_no_forms_at_all_is_analysed_without_throwing()
    {
        var analysis = VerbAnalyzer.Analyze("x", new Dictionary<string, string[][]>());

        analysis.Kind.Should().Be("feature");
        analysis.Root.Should().BeEmpty();
    }
}
