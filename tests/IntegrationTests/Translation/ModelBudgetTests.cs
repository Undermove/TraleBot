using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation.Pipeline;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Translation;

/// <summary>
/// The daily caps on model calls: overall and per user, a separate lower one for the strong model,
/// counted in the database. Over a cap a request silently takes the path without models.
/// </summary>
public class ModelBudgetTests : TranslationPipelineTestBase
{
    private const string NotAVerb = """{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""";
    private static readonly Guid Ann = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid Bob = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000002");

    private Task<List<ModelBudgetDay>> Counters() =>
        InScope(sp => sp.GetRequiredService<ITraleDbContext>().ModelBudgetDays.AsNoTracking().OrderBy(b => b.UserId).ToListAsync());

    [Test]
    public async Task User_over_the_daily_cap_gets_the_old_translation_while_others_still_get_the_models()
    {
        await SeedCatalogWithout();
        Options.MaxModelRequestsPerUserPerDay = 2;
        Models.ClassifierModel.AnswerWith(NotAVerb);

        await TranslateAs(Ann, "стол");
        await TranslateAs(Ann, "дом");
        var third = await TranslateAs(Ann, "окно");
        await TranslateAs(Bob, "вода");

        third.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("not-a-verb>legacy", "not-a-verb>legacy", "over-daily-budget>legacy", "not-a-verb>legacy");
        Models.ClassifierModel.Calls.Should().Be(3);

        // The text that went without a model is not written off: it is asked about another day.
        var cached = await CacheEntries();
        cached.Single(c => c.Key == "окно").Classified.Should().BeFalse();

        var counters = await Counters();
        counters.Single(c => c.UserId == Ann).Requests.Should().Be(2);
        counters.Single(c => c.UserId == Bob).Requests.Should().Be(1);
        counters.Single(c => c.UserId == ModelBudgetDay.Everyone).Requests.Should().Be(3,
            because: "a user who is over the own cap does not use up the common budget");
        counters.Should().OnlyContain(c => c.Day == DateOnly.FromDateTime(DateTime.UtcNow));
    }

    [Test]
    public async Task Overall_cap_holds_across_users_and_is_kept_in_the_database_not_in_the_process()
    {
        await SeedCatalogWithout();
        Options.MaxModelRequestsPerDay = 2;
        Models.ClassifierModel.AnswerWith(NotAVerb);

        await TranslateAs(Ann, "стол");
        await TranslateAs(Bob, "дом");
        await TranslateAs(Guid.NewGuid(), "окно");
        await Translate("вода"); // no user at all: the overall cap still applies

        Log.Paths.Should().Equal("not-a-verb>legacy", "not-a-verb>legacy", "over-daily-budget>legacy", "over-daily-budget>legacy");
        Models.ClassifierModel.Calls.Should().Be(2);

        // Nothing is kept in memory: every request above built its own ModelBudget, and the count that
        // stopped the third one is a row — which is what a restarted process would read.
        (await Counters()).Single(c => c.UserId == ModelBudgetDay.Everyone).Requests.Should().Be(2);
        var afterRestart = await InScope(sp => sp.GetRequiredService<ModelBudget>().TrySpendAsync(ModelSpend.Request, CancellationToken.None));
        afterRestart.Should().BeFalse();
    }

    [Test]
    public async Task Yesterdays_count_does_not_limit_today()
    {
        await SeedCatalogWithout();
        Options.MaxModelRequestsPerDay = 1;
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.ModelBudgetDays.Add(new ModelBudgetDay
            {
                Id = Guid.NewGuid(), Day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1), UserId = ModelBudgetDay.Everyone, Requests = 1
            });
            db.ModelBudgetDays.Add(new ModelBudgetDay
            {
                Id = Guid.NewGuid(), Day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-40), UserId = ModelBudgetDay.Everyone, Requests = 5
            });
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        Models.ClassifierModel.AnswerWith(NotAVerb);

        await Translate("стол");

        Log.Paths.Should().Equal("not-a-verb>legacy");
        (await Counters()).Select(c => c.Day).Should().NotContain(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-40), because: "old rows are cleared when a day starts");
    }

    [Test]
    public async Task Zero_means_no_cap()
    {
        await SeedCatalogWithout();
        Options.MaxModelRequestsPerDay = 0;
        Options.MaxModelRequestsPerUserPerDay = 0;
        Models.ClassifierModel.AnswerWith(NotAVerb);

        foreach (var word in new[] { "стол", "дом", "окно" })
        {
            await TranslateAs(Ann, word);
        }

        Log.Paths.Should().OnlyContain(p => p == "not-a-verb>legacy");
    }

    [Test]
    public async Task Strong_model_has_its_own_lower_cap_and_a_verb_over_it_is_translated_the_old_way_for_now()
    {
        var dance = Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать");
        var lemma = dance["lemma"]!.GetValue<string>();
        await SeedCatalogWithout(lemma);
        Lexicon.Verbs.Add(new LexiconVerb(lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Options.MaxGenerationsPerUserPerDay = 1;
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        // The first generation is used up on a record the reviewer turns down (twice).
        Models.GeneratorModel.AnswerWith("""{"verdict":"notAVerb"}""");

        await TranslateAs(Ann, "танцевал");
        var second = await TranslateAs(Ann, "танцевать");

        Log.Paths.Should().Equal("lexicon-no-table>generator>not-a-verb>legacy", "lexicon-no-table>over-generation-budget>legacy");
        second.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Models.GeneratorModel.Calls.Should().Be(1);
        (await CacheEntries()).Single(c => c.Key == "танцевать").Classified.Should().BeFalse(
            because: "tomorrow the verb may still be written");
        var counters = await Counters();
        counters.Single(c => c.UserId == Ann).Generations.Should().Be(1);
        counters.Single(c => c.UserId == Ann).Requests.Should().Be(2);

        // Another user is not held back by Ann's cap; the overall one would hold everyone.
        Options.MaxGenerationsPerDay = 1;
        await TranslateAs(Bob, "танцевали");
        Log.Paths.Last().Should().Be("lexicon-no-table>over-generation-budget>legacy");
    }
}
