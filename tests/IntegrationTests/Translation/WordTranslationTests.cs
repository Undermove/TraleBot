using System.Text.Json;
using Application.Common.Interfaces.TranslationService;
using Application.Translation.Cache;
using Application.Translation.Pipeline;
using FluentAssertions;
using Microsoft.Extensions.AI;

namespace IntegrationTests.Translation;

/// <summary>
/// A plain word (not a verb): the model gives the everyday translation, the dictionary site is the
/// second opinion. What the dictionary confirms is cached; what it contradicts never reaches the user.
/// </summary>
public class WordTranslationTests : TranslationPipelineTestBase
{
    private const string NotAVerb = """{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""";

    private const string Grapes = "ყურძენი";
    private const string EuropeanVine = "ევროპული ვაზი";

    private static string Word(string? translation, string[]? alternatives = null, string? note = null) =>
        JsonSerializer.Serialize(new { translation, alternatives = alternatives ?? [], note });

    [SetUp]
    public void WordTranslatorOn()
    {
        Models.CanTranslateWords = true;
        Models.ClassifierModel.AnswerWith(NotAVerb);
    }

    /// <summary>The model answers each call with the next JSON of the list.</summary>
    private void TranslatorAnswers(params string[] answers)
    {
        var next = 0;
        Models.TranslatorModel.Respond = (_, _) =>
            Task.FromResult(new ChatMessage(ChatRole.Assistant, answers[Math.Min(next++, answers.Length - 1)]));
    }

    private string LastQuestion() =>
        Models.TranslatorModel.Conversations.Last().Last(m => m.Role == ChatRole.User).Text;

    [Test]
    public async Task Everyday_word_is_chosen_over_the_dictionarys_first_entry_and_cached()
    {
        await SeedCatalogWithout();
        External.Page("виноград", EuropeanVine, Grapes, "ვაზი");
        TranslatorAnswers(Word(Grapes, ["ვაზი", "ყურძნის მტევანი"]));

        var first = await Translate("Виноград");
        var second = await Translate("виноград");

        var answer = first.Should().BeOfType<TranslationResult.Success>().Subject;
        answer.Definition.Should().Be(Grapes);
        answer.AdditionalInfo.Should().StartWith("ещё: ვაზი\n", because: "a Georgian alternative is named only when the dictionary lists it too");
        answer.AdditionalInfo.Should().EndWith("Транскрипция: [къурдзэни]");
        answer.Example.Should().Be(FakeExternalTranslator.Example);
        second.Should().Be(first);
        LastQuestion().Should().Contain($"{EuropeanVine}; {Grapes}; ვაზი", because: "the dictionary's entries are the model's hint");
        Models.TranslatorModel.Calls.Should().Be(1);
        External.Calls.Should().Be(0, because: "the old translator is not asked");
        (await CacheEntries()).Should().ContainSingle().Which.Source.Should().Be(TranslationCache.SourceWordAgent);
        Log.Paths.Should().Equal("not-a-verb>word-agent", "cache");
    }

    [Test]
    public async Task Word_outside_the_entries_is_accepted_when_the_dictionary_knows_it()
    {
        await SeedCatalogWithout();
        External.Page("завтра", "ხვალე");
        External.Page("ხვალ", "завтра");
        TranslatorAnswers(Word("ხვალ"));

        var result = await Translate("завтра");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be("ხვალ");
        External.Trail.Should().Equal("page:завтра", "page:ხვალ");
        Log.Paths.Should().Equal("not-a-verb>word-agent");
    }

    [Test]
    public async Task Made_up_word_is_sent_back_once_and_the_second_answer_is_checked_again()
    {
        await SeedCatalogWithout();
        External.Page("виноград", EuropeanVine, Grapes);
        TranslatorAnswers(Word("ყურძენო"), Word(Grapes));

        var result = await Translate("виноград");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Grapes);
        LastQuestion().Should().Contain("no Georgian word «ყურძენო»");
        Log.Paths.Should().Equal("not-a-verb>word-retry>word-agent");
    }

    [Test]
    public async Task Answer_the_dictionary_contradicts_twice_never_reaches_the_user()
    {
        await SeedCatalogWithout();
        External.Page("виноград", EuropeanVine);
        TranslatorAnswers(Word("ყურძენო"));

        var result = await Translate("виноград");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Models.TranslatorModel.Calls.Should().Be(2);
        (await CacheEntries()).Should().ContainSingle().Which.Source.Should().Be(TranslationCache.SourceNoTranslation);
        Log.Paths.Should().Equal("not-a-verb>word-retry>word-rejected>legacy");
    }

    [Test]
    public async Task Phrase_nobody_can_confirm_is_served_with_a_note_and_not_cached()
    {
        await SeedCatalogWithout();
        TranslatorAnswers(Word("რამდენი წლის ხარ?"));
        External.Page("რამდენი", "сколько");
        External.Page("წლის", "годовой");

        var first = await Translate("сколько тебе лет");
        await Translate("сколько тебе лет");

        var answer = first.Should().BeOfType<TranslationResult.Success>().Subject;
        answer.Definition.Should().Be("რამდენი წლის ხარ?");
        answer.AdditionalInfo.Should().StartWith(GeorgianTranslationPipeline.UnconfirmedWordNote);
        answer.Example.Should().BeEmpty();
        Models.TranslatorModel.Calls.Should().Be(2, because: "an unconfirmed answer is asked for again next time");
        External.Calls.Should().Be(0);
        Log.Paths.Should().Equal("not-a-verb>word-unconfirmed", "word-unconfirmed");
    }

    [Test]
    public async Task Georgian_word_the_dictionary_knows_gets_the_models_russian_and_is_cached()
    {
        await SeedCatalogWithout();
        External.Page("წადი", "уходите", "иди");
        TranslatorAnswers(Word("иди", ["уходи"], "обращение к одному человеку"));

        var answer = (await Translate("წადი")).Should().BeOfType<TranslationResult.Success>().Subject;

        answer.Definition.Should().Be("иди");
        answer.AdditionalInfo.Should().StartWith("обращение к одному человеку; ещё: уходи\nТранскрипция: [ц’ади]");
        (await CacheEntries()).Should().ContainSingle().Which.Source.Should().Be(TranslationCache.SourceWordAgent);
    }

    [Test]
    public async Task Georgian_form_the_dictionary_lacks_is_translated_by_the_model_with_a_note_not_by_google()
    {
        await SeedCatalogWithout();
        TranslatorAnswers(Word("из окна"));

        var answer = (await Translate("ფანჯრიდან")).Should().BeOfType<TranslationResult.Success>().Subject;

        answer.Definition.Should().Be("из окна");
        answer.AdditionalInfo.Should().Contain(GeorgianTranslationPipeline.UnconfirmedWordNote);
        External.Trail.Should().Equal("page:ფანჯრიდან");
    }

    [Test]
    public async Task Word_settled_as_not_a_verb_before_the_word_translator_existed_is_translated_by_it_now()
    {
        await SeedCatalogWithout();
        Models.CanTranslateWords = false;
        await Translate("виноград");
        Models.CanTranslateWords = true;
        External.Page("виноград", EuropeanVine, Grapes);
        TranslatorAnswers(Word(Grapes));

        var result = await Translate("виноград");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(Grapes);
        Models.ClassifierModel.Calls.Should().Be(1, because: "the verdict «not a verb» is remembered");
        Log.Paths.Should().Equal("not-a-verb>legacy", "word-agent");
        (await CacheEntries()).Should().ContainSingle().Which.Source.Should().Be(TranslationCache.SourceWordAgent);
    }

    [Test]
    public async Task Dictionary_outage_leaves_the_models_answer_unconfirmed()
    {
        await SeedCatalogWithout();
        External.PagesFail = true;
        TranslatorAnswers(Word(Grapes));

        var answer = (await Translate("виноград")).Should().BeOfType<TranslationResult.Success>().Subject;

        answer.Definition.Should().Be(Grapes);
        answer.AdditionalInfo.Should().StartWith(GeorgianTranslationPipeline.UnconfirmedWordNote);
        Log.Paths.Should().Equal("not-a-verb>word-unconfirmed");
    }

    [Test]
    public async Task Model_error_falls_back_to_the_old_translator()
    {
        await SeedCatalogWithout();
        External.Page("виноград", EuropeanVine);
        Models.TranslatorModel.Respond = (_, _) => throw new HttpRequestException("429 insufficient_quota");

        var result = await Translate("виноград");

        result.Should().BeOfType<TranslationResult.Success>().Which.Definition.Should().Be(FakeExternalTranslator.Definition);
        Log.Paths.Should().Equal("not-a-verb>word-failed>legacy");
    }

    [Test]
    public async Task Sentence_is_not_given_to_the_word_translator()
    {
        await SeedCatalogWithout();

        await Translate("где здесь можно купить хлеб");

        Models.ModelCalls.Should().Be(0);
        Log.Paths.Should().Equal("legacy");
    }
}
