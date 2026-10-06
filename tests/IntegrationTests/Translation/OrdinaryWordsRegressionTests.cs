using Application.Common;
using Application.Common.Interfaces.TranslationService;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Translation;

/// <summary>
/// The owner's rule: translation of ordinary words and sentences must not change. A noun, an adjective,
/// an adverb, a phrase, a sentence goes the old way — the dictionary site first, Google only after it —
/// and gets the old answer; with the agent on, the only thing a model says about such a text is "not a
/// verb". Each text is translated with the agent off and then, from a clean cache, with the agent on:
/// the old translator must be asked the same questions in the same order and the answer must be the same.
/// </summary>
public class OrdinaryWordsRegressionTests : TranslationPipelineTestBase
{
    private const string NotAVerb = """{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""";

    // Russian only: the tests do not invent Georgian. The second column: does the dictionary site have an entry.
    private static readonly (string Text, bool InDictionary)[] Ordinary =
    [
        ("слива", true), ("стол", true), ("дом", true), ("вода", true), ("хлеб", true), ("собака", true),
        ("красивый", true), ("большой", true), ("холодная", true),
        ("быстро", true), ("завтра", true), ("очень", true),
        ("доброе утро", true), ("большой дом", true), ("чашка кофе", true),
        // Not in the dictionary site: Google is asked second, as it always was.
        ("синхрофазотрон", false), ("кисломолочный", false),
        // Sentences — with a verb in them, too: a sentence is a sentence.
        ("где находится вокзал", false), ("я хочу купить билет", false), ("он сказал мне правду вчера", false),
        ("сколько это стоит", false), ("мы завтра идём в кино", false)
    ];

    private async Task ClearCache() => await InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        db.TranslationCache.RemoveRange(await db.TranslationCache.ToListAsync());
        return await db.SaveChangesAsync(CancellationToken.None);
    });

    [Test]
    public async Task Ordinary_words_and_sentences_take_the_old_path_with_the_agent_on_exactly_as_with_it_off()
    {
        await SeedCatalogWithout();
        foreach (var (text, inDictionary) in Ordinary.Where(o => !o.InDictionary))
        {
            External.DictionaryMisses.Add(text);
        }

        // Agent off: the translator as it was before any model.
        Models.Configured = false;
        var before = new List<(TranslationResult Result, List<string> Asked)>();
        foreach (var (text, _) in Ordinary)
        {
            External.Trail.Clear();
            before.Add((await Translate(text), External.Trail.ToList()));
        }

        Log.Paths.Should().OnlyContain(path => path == "legacy");
        await ClearCache();

        // Agent on. The analyst, the generator and the reviewer are throwing fakes: any call fails the test.
        Models.Configured = true;
        Models.ClassifierModel.AnswerWith(NotAVerb);
        Log.Reset();
        for (var i = 0; i < Ordinary.Length; i++)
        {
            var (text, inDictionary) = Ordinary[i];
            External.Trail.Clear();

            var result = await Translate(text);

            result.Should().Be(before[i].Result, $"«{text}» gets the answer it always got");
            External.Trail.Should().Equal(before[i].Asked, $"«{text}» asks the old translator the same way");
            External.Trail.Should().Equal(
                inDictionary ? [$"dictionary:{text}"] : [$"dictionary:{text}", $"google:{text}"],
                "the dictionary site first, Google only after it");
            result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(
                inDictionary ? FakeExternalTranslator.Definition : FakeExternalTranslator.GoogleDefinition);
        }

        Log.Paths.Should().OnlyContain(path => path == "not-a-verb>legacy");
        Models.ClassifierModel.Calls.Should().Be(Ordinary.Length, because: "one cheap call says «not a verb» — the model's only job here");
        (Models.AnalystModel.Calls, Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((0, 0, 0));
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs.CountAsync(v => v.Status == Domain.Entities.VerbStatus.Generated)))
            .Should().Be(0);
    }

    [TestCase("classifier-error")]
    [TestCase("classifier-timeout")]
    [TestCase("classifier-unsure-not-translatable")]
    public async Task Any_doubt_about_an_ordinary_word_ends_in_the_old_translation(string doubt)
    {
        await SeedCatalogWithout();
        switch (doubt)
        {
            case "classifier-error":
                Models.ClassifierModel.Respond = (_, _) => throw new InvalidOperationException("provider is down");
                break;
            case "classifier-timeout":
                Models.ClassifierModel.Respond = async (_, ct) =>
                {
                    await Task.Delay(TimeSpan.FromSeconds(30), ct);
                    throw new InvalidOperationException("unreachable");
                };
                break;
            default:
                // The small model calls a real noun "not something to translate": the dictionary site knows better.
                Models.ClassifierModel.AnswerWith("""{"notTranslatable":true,"isVerb":false,"russianInfinitive":null}""");
                break;
        }

        var result = await Translate("слива");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        (Models.AnalystModel.Calls, Models.GeneratorModel.Calls, Models.ReviewerModel.Calls).Should().Be((0, 0, 0));
    }
}
