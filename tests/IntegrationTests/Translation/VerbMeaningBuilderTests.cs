using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Verbs;
using FluentAssertions;

namespace IntegrationTests.Translation;

/// <summary>
/// One implementation per rule: the catalog's phrases are built by <c>scripts/verbs/meanings.mjs</c>,
/// the phrases of a verb stored at runtime by <see cref="VerbMeaningBuilder"/>. This test ties them —
/// the C# builder must reproduce every phrase and every note of <c>verbs.json</c> from the same
/// <c>ru-forms.json</c> the script read.
/// </summary>
public class VerbMeaningBuilderTests
{
    private static JsonNode Load(string file) =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", file)))!;

    [Test]
    public void Builder_reproduces_the_phrases_of_every_catalog_verb()
    {
        var forms = Load("ru-forms.json").AsObject();
        var verbs = Load("verbs.json")["verbs"]!.AsArray();
        var compared = 0;

        foreach (var verb in verbs.Select(v => v!.AsObject()))
        {
            var lemma = verb["lemma"]!.GetValue<string>();
            var entry = forms[lemma].Deserialize<RussianVerbForms>()!;

            var built = VerbMeaningBuilder.Build(entry, verb["tenses"]!.AsObject().Select(t => t.Key).ToList());

            JsonSerializer.SerializeToNode(built.Meanings)!.ToJsonString()
                .Should().Be(Sorted(verb["meanings"]!), $"phrases of {lemma}");
            JsonSerializer.SerializeToNode(built.Chips)!.ToJsonString()
                .Should().Be(Sorted(verb["meaningChips"]!), $"notes of {lemma}");
            compared++;
        }

        compared.Should().BeGreaterThan(100);

        // The catalog stores tenses in the card's order; the builder walks the same list.
        static string Sorted(JsonNode node)
        {
            var source = node.AsObject();
            var ordered = new JsonObject();
            foreach (var tense in VerbAnalyzer.CardTenses.Where(source.ContainsKey))
            {
                ordered[tense] = source[tense]!.DeepClone();
            }

            return ordered.ToJsonString();
        }
    }

    private static readonly RussianVerbForms Speak = new(
        "говорить",
        new RussianPast("говорил", "говорила", "говорили"),
        ["говорю", "говоришь", "говорит", "говорим", "говорите", "говорят"],
        Perfective: new RussianVerbForms(
            "сказать",
            new RussianPast("сказал", "сказала", "сказали"),
            Future: ["скажу", "скажешь", "скажет", "скажем", "скажете", "скажут"]));

    [Test]
    public void Perfective_partner_gives_the_one_off_past_and_the_simple_future()
    {
        var built = VerbMeaningBuilder.Build(Speak, VerbAnalyzer.CardTenses.ToList());

        built.Meanings["present"][0].Should().Be("я говорю");
        built.Meanings["imperfect"][0].Should().Be("я говорил(а)");
        built.Meanings["aorist"].Should().Equal("я сказал(а)", "ты сказал(а)", "он сказал", "мы сказали", "вы сказали", "они сказали");
        built.Meanings["future"][3].Should().Be("мы скажем");
        built.Meanings["optative"][2].Should().Be("ему надо сказать");
        built.Meanings["conditional"][5].Should().Be("они бы сказали");
        built.Chips.Should().BeEmpty(because: "with two Russian verbs no two tenses read the same");
        built.Problems.Should().BeEmpty();
    }

    [Test]
    public void Forms_a_model_wrote_are_checked_for_shape_only()
    {
        VerbMeaningBuilder.ShapeProblems(Speak).Should().BeEmpty();
        VerbMeaningBuilder.ShapeProblems(null).Should().ContainSingle();
        VerbMeaningBuilder.ShapeProblems(Speak with { Present = ["говорю"] })
            .Should().ContainSingle().Which.Should().Contain("six personal forms");
        VerbMeaningBuilder.ShapeProblems(Speak with { Inf = "to speak" })
            .Should().ContainSingle().Which.Should().Contain("Cyrillic");
        VerbMeaningBuilder.ShapeProblems(Speak with { Perfective = Speak.Perfective! with { Future = null } })
            .Should().ContainSingle().Which.Should().Contain("perfective.future");
    }
}
