using System.Text.Json.Nodes;
using Application.Verbs;
using FluentAssertions;

namespace IntegrationTests.MiniApp;

/// <summary>
/// The ladder of the «Глаголы» section (<c>src/Trale/Verbs/levels.json</c>, built by
/// <c>scripts/verbs/build-levels.mjs</c>) against the curated catalog it orders.
/// </summary>
public class VerbLevelsDataTests
{
    private static string Read(string file) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", file));

    private static readonly VerbLevelCatalog Ladder = VerbLevelCatalog.Parse(Read("levels.json"));

    private static List<string> CatalogLemmas() =>
        JsonNode.Parse(Read("verbs.json"))!["verbs"]!.AsArray().Select(v => v!["lemma"]!.GetValue<string>()).ToList();

    [Test]
    public void Every_curated_verb_is_in_exactly_one_pack()
    {
        var placed = Ladder.Levels.SelectMany(l => l.Packs).SelectMany(p => p.Verbs).ToList();

        placed.Should().OnlyHaveUniqueItems("a verb must not sit in two packs");
        placed.Should().BeEquivalentTo(CatalogLemmas(), "every catalog verb is led to, and nothing outside the catalog is");
    }

    [Test]
    public void Packs_have_four_to_six_verbs_and_stable_unique_ids()
    {
        var packs = Ladder.Levels.SelectMany(l => l.Packs).ToList();

        packs.Should().OnlyContain(p => p.Verbs.Count >= VerbLevelCatalog.PackMin && p.Verbs.Count <= VerbLevelCatalog.PackMax);
        packs.Select(p => p.Id).Should().OnlyHaveUniqueItems();
        packs.Should().OnlyContain(p => System.Text.RegularExpressions.Regex.IsMatch(p.Id, "^[a-z][a-z0-9-]*$") && p.Title.Length > 0);
    }

    [Test]
    public void There_are_five_levels_in_order_and_the_first_is_the_smallest()
    {
        Ladder.Levels.Select(l => l.Id).Should().Equal(1, 2, 3, 4, 5);
        Ladder.Levels.Should().OnlyContain(l => l.Title.Length > 0);
        Ladder.Levels[0].Packs.Sum(p => p.Verbs.Count).Should().BeLessThan(Ladder.Levels[1].Packs.Sum(p => p.Verbs.Count));
    }

    [Test]
    public void The_recommended_order_follows_levels_then_packs()
    {
        var first = Ladder.Levels[0].Packs[0];

        Ladder.Lemmas.Take(first.Verbs.Count).Should().Equal(first.Verbs);
        Ladder.PlaceOf(first.Verbs[0]).Should().Be(new VerbPlace(1, first.Id, 0));
        Ladder.PlaceOf("нет такого").Should().BeNull();
    }
}
