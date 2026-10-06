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
    private static JsonArray Catalog() =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json")))!["verbs"]!.AsArray();

    // Named by position and gloss: several catalog verbs share a Russian gloss.
    private static IEnumerable<TestCaseData> CatalogVerbs() =>
        Catalog().Select((v, i) =>
            new TestCaseData(v!.ToJsonString()).SetArgDisplayNames($"{i + 1:000} {v!["ru"]!.GetValue<string>()}"));

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
    public void Every_catalog_verb_is_a_parity_case()
    {
        // No verb is left out: the catalog build feeds the script nothing the runtime lacks. The only
        // extra input is `partial`, and it is computed from the table itself (VerbAnalyzer.IsPartial).
        CatalogVerbs().Should().HaveCountGreaterThan(150);
    }

    [Test]
    public void Catalog_has_every_kind_of_verb_the_port_must_tell_apart()
    {
        var reasons = Catalog().Select(v => v!["reason"]!.GetValue<string>()).ToList();

        reasons.Should().Contain(r => r.StartsWith("Перевёртыш") && r.EndsWith("часть времён."));
        reasons.Should().Contain(r => r.StartsWith("Перевёртыш") && r.EndsWith("окончание."));
        reasons.Should().Contain("В источнике есть только часть времён — учить формы целиком.");
        reasons.Should().Contain("В разных временах разные корни — учить целиком.");
        reasons.Should().Contain("В прошедшем «сделал» меняется основа, а не только окончание.");
        reasons.Should().Contain("Будущее совпадает с настоящим, приставки нет.");
        reasons.Should().Contain(r => r.StartsWith("Будущее и прошедшее «сделал» получают"));
        reasons.Should().Contain(r => r.StartsWith("Будущее и прошедшее «сделал» = приставка"));
    }

    [Test]
    public void Table_without_a_full_present_future_and_aorist_is_partial()
    {
        var full = Catalog().Select(v => v!["tenses"].Deserialize<Dictionary<string, string[][]>>()!)
            .First(t => !VerbAnalyzer.IsPartial(t));

        var withoutAorist = full.Where(t => t.Key != "aorist").ToDictionary(t => t.Key, t => t.Value);
        var withAGap = full.ToDictionary(t => t.Key, t => t.Key == "future" ? t.Value.Select((c, i) => i == 4 ? [] : c).ToArray() : t.Value);

        VerbAnalyzer.IsPartial(withoutAorist).Should().BeTrue();
        VerbAnalyzer.IsPartial(withAGap).Should().BeTrue();
        VerbAnalyzer.Analyze("x", withoutAorist).Reason.Should().Be("В источнике есть только часть времён — учить формы целиком.");
    }

    [Test]
    public void Verb_with_no_forms_at_all_is_analysed_without_throwing()
    {
        VerbAnalyzer.Analyze("x", new Dictionary<string, string[][]>()).Kind.Should().Be("special");
        // Asked to treat an empty table as complete, the port still must not throw (the script would).
        VerbAnalyzer.Analyze("x", new Dictionary<string, string[][]>(), partial: false).Root.Should().BeEmpty();
    }
}
