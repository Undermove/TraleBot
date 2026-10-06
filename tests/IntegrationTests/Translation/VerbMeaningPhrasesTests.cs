using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Verbs;
using FluentAssertions;

namespace IntegrationTests.Translation;

/// <summary>
/// Matching a typed Russian verb form against the plain-Russian meanings of the catalog — the rules
/// that let «ходил» be answered from the database. Checked on the real catalog, not on samples.
/// </summary>
public class VerbMeaningPhrasesTests
{
    private static IEnumerable<(string Meaning, int Person)> CatalogMeanings() =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json")))!["verbs"]!.AsArray()
            .SelectMany(v => (v!["meanings"] as JsonObject ?? new JsonObject())
                .SelectMany(t => t.Value.Deserialize<string[]>()!.Select((m, person) => (m, person))));

    [Test]
    public void Every_catalog_phrase_is_found_by_each_way_of_typing_it()
    {
        var phrases = CatalogMeanings().ToList();
        phrases.Should().HaveCountGreaterThan(5000);

        foreach (var (meaning, _) in phrases)
        {
            foreach (var (full, bare) in VerbMeaningPhrases.Variants(meaning))
            {
                VerbMeaningPhrases.Matches(VerbMeaningPhrases.Parse(full), meaning).Should().BeTrue($"«{full}» is «{meaning}»");
                VerbMeaningPhrases.Matches(VerbMeaningPhrases.Parse(bare), meaning).Should().BeTrue($"«{bare}» is «{meaning}»");
                full.Should().NotContainAny("(", "/", "ё");
            }
        }
    }

    [Test]
    public void Phrase_typed_with_its_pronoun_names_exactly_its_person()
    {
        foreach (var (meaning, person) in CatalogMeanings())
        {
            var typed = VerbMeaningPhrases.Variants(meaning).First().Full;
            var asked = VerbMeaningPhrases.Parse(typed);
            if (asked.Person != null)
            {
                asked.Person.Should().Be(person, $"«{typed}»");
            }
        }
    }

    [TestCase("я ходил(а)", "ходил", "ходила", "я ходил", "я ходила")]
    [TestCase("я шёл / шла", "шел", "шла", "я шел", "я шла")]
    [TestCase("я бы шёл / шла", "бы шел", "бы шла", "я бы шла")]
    [TestCase("я следовал(а) за кем-то", "следовала за кем-то", "я следовал за кем-то")]
    [TestCase("он идёт", "идет", "идёт", "он идет", "она идет", "оно идет")]
    [TestCase("мне надо идти", "мне надо идти", "надо идти", "ей надо идти")]
    [TestCase("у меня есть", "у меня есть")]
    public void Phrase_is_matched_by(string meaning, params string[] typed)
    {
        foreach (var text in typed)
        {
            VerbMeaningPhrases.Matches(VerbMeaningPhrases.Parse(text), meaning).Should().BeTrue($"«{text}»");
        }
    }

    [TestCase("я ходил(а)", "ходили")]
    [TestCase("я ходил(а)", "ходит")]
    [TestCase("он идёт", "идут")]
    [TestCase("я шёл / шла", "шли")]
    public void Phrase_is_not_matched_by(string meaning, string typed)
    {
        VerbMeaningPhrases.Matches(VerbMeaningPhrases.Parse(typed), meaning).Should().BeFalse();
    }

    // Persons whose phrase matched → the person to answer with.
    [TestCase("ходил", new[] { 0, 1, 2 }, 2, TestName = "Bare_masculine_past_is_he")]
    [TestCase("ходила", new[] { 0, 1 }, 2, TestName = "Bare_feminine_past_is_she")]
    [TestCase("ходили", new[] { 3, 4, 5 }, 5, TestName = "Bare_plural_past_is_they")]
    [TestCase("иду", new[] { 0 }, 0, TestName = "Form_that_shows_its_person_keeps_it")]
    [TestCase("я ходил", new[] { 0, 1, 2 }, 0, TestName = "Pronoun_decides")]
    [TestCase("ты ходила", new[] { 0, 1 }, 1, TestName = "Pronoun_decides_for_a_feminine_form")]
    [TestCase("она ходила", new[] { 0, 1 }, 2, TestName = "She_is_the_third_person_though_the_stored_phrase_is_masculine")]
    [TestCase("надо идти", new[] { 0, 1, 2, 3, 4, 5 }, 2, TestName = "Phrase_without_who_is_he")]
    public void Person_is_picked(string typed, int[] matched, int expected)
    {
        VerbMeaningPhrases.PickPerson(VerbMeaningPhrases.Parse(typed), matched).Should().Be(expected);
    }

    [Test]
    public void Named_person_that_did_not_match_is_no_answer()
    {
        VerbMeaningPhrases.PickPerson(VerbMeaningPhrases.Parse("мы ходил"), [0, 1, 2]).Should().BeNull();
    }
}
