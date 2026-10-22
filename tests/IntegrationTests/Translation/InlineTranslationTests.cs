using System.Net;
using FluentAssertions;
using Infrastructure.Telegram.Inline;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Telegram.Bot.Requests;
using Telegram.Bot.Types;
using Telegram.Bot.Types.InlineQueryResults;
using Telegram.Bot.Types.ReplyMarkups;

namespace IntegrationTests.Translation;

/// <summary>
/// Inline mode: «@bot писал» in any chat. The answer is one card to send — the Georgian word with its
/// Cyrillic transcription and the Russian — and a button into the bot, tagged so that whoever comes
/// this way is counted.
/// </summary>
public class InlineTranslationTests : TranslationPipelineTestBase
{
    private static readonly string Write =
        Catalog().Select(v => v!.AsObject()).Single(v => v["ru"]!.GetValue<string>() == "писать")["lemma"]!.GetValue<string>();

    private static string Cyrillic(string georgian) =>
        Application.Translation.Languages.GeorgianTranscriptionExtension.GetTranscription(georgian);

    private int _updateId = 7000;

    private async Task<AnswerInlineQueryRequest> Ask(long userTelegramId, string query)
    {
        using var client = App.CreateClient();
        var update = new Update
        {
            Id = ++_updateId,
            InlineQuery = new InlineQuery
            {
                Id = $"q{_updateId}",
                From = new global::Telegram.Bot.Types.User { Id = userTelegramId, FirstName = "Test" },
                Query = query,
                Offset = ""
            }
        };
        var response = await client.PostAsync("/telegram/test_token", update.ToJsonContent());
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return Telegram.Requests.OfType<AnswerInlineQueryRequest>().Single(r => r.InlineQueryId == $"q{_updateId}");
    }

    [Test]
    public async Task A_russian_word_from_someone_who_never_started_the_bot_gets_a_card_with_the_georgian_and_its_transcription()
    {
        await SeedCatalogWithout();
        Models.Configured = false;
        var he = Form(CatalogVerb(Write), "imperfect", 2);

        var answer = await Ask(920001, "писал");

        var card = answer.Results.Should().ContainSingle().Which.Should().BeOfType<InlineQueryResultArticle>().Which;
        ((InputTextMessageContent)card.InputMessageContent).MessageText.Should().Be($"{he} [{Cyrillic(he)}] — писал");
        card.Title.Should().Be($"{he} [{Cyrillic(he)}]");
        card.Description.Should().Be("писал");
        var button = ((InlineKeyboardMarkup)card.ReplyMarkup!).InlineKeyboard.Single().Single();
        button.Url.Should().EndWith($"?start={InlineTranslation.StartParameter}",
            because: "people in the chat who tap the card's button are counted as coming from inline mode");
        answer.Button!.StartParameter.Should().Be(InlineTranslation.StartParameter);
        answer.IsPersonal.Should().BeFalse(because: "a translation is the same for everybody, Telegram may reuse it");
    }

    [Test]
    public async Task A_whole_message_is_translated_by_one_model_call()
    {
        Models.ClassifierModel.AnswerWith("""{"georgian":"კატას ფანჯარაზე სძინავს","russian":"Кошка спит на окне"}""");

        var answer = await Ask(920006, "Кошка спит на окне");

        var card = (InlineQueryResultArticle)answer.Results.Should().ContainSingle().Which;
        ((InputTextMessageContent)card.InputMessageContent).MessageText.Should()
            .Be($"კატას ფანჯარაზე სძინავს [{Cyrillic("კატას ფანჯარაზე სძინავს")}] — Кошка спит на окне");
        Models.ModelCalls.Should().Be(1, because: "Telegram waits a few seconds only: one fast call, not the dictionary pipeline");
    }

    [Test]
    public async Task Georgian_typed_in_latin_letters_is_shown_in_georgian_script_with_the_russian()
    {
        Models.ClassifierModel.AnswerWith("""{"georgian":"გამარჯობა, როგორ ხარ?","russian":"Привет, как дела?"}""");

        var answer = await Ask(920007, "gamarjoba, rogor xar?");

        var card = (InlineQueryResultArticle)answer.Results.Should().ContainSingle().Which;
        ((InputTextMessageContent)card.InputMessageContent).MessageText.Should()
            .Be($"გამარჯობა, როგორ ხარ? [{Cyrillic("გამარჯობა, როგორ ხარ?")}] — Привет, как дела?");
    }

    [Test]
    public async Task A_mixed_text_gets_both_sides_from_the_model_not_the_text_as_typed()
    {
        Models.ClassifierModel.AnswerWith("""{"georgian":"სად ხარ და კარგად, შენ?","russian":"Где ты? И хорошо, а ты?"}""");

        var answer = await Ask(920009, "sad xar и kargad, shen?");

        var card = (InlineQueryResultArticle)answer.Results.Should().ContainSingle().Which;
        card.Description.Should().Be("Где ты? И хорошо, а ты?",
            because: "a Russian word in Latin Georgian does not make the text Russian");
    }

    [Test]
    public async Task English_gets_no_card()
    {
        Models.ClassifierModel.AnswerWith("""{"georgian":null,"russian":null}""");

        var answer = await Ask(920008, "where is the pharmacy");

        answer.Results.Should().BeEmpty();
    }

    [Test]
    public async Task Text_without_letters_gets_no_cards_and_no_lookup()
    {
        await SeedCatalogWithout();

        var answer = await Ask(920002, "12345");

        answer.Results.Should().BeEmpty();
        answer.Button!.Text.Should().Be(InlineTranslation.ButtonText);
        Models.ClassifierModel.Calls.Should().Be(0);
    }

    [Test]
    public async Task An_empty_query_offers_the_first_phrases_a_newcomer_needs()
    {
        var answer = await Ask(920004, "");

        answer.Results.Should().HaveCount(InlineTranslation.Starters.Length);
        var first = (InlineQueryResultArticle)answer.Results.First();
        ((InputTextMessageContent)first.InputMessageContent).MessageText.Should().Be("მადლობა [мадлоба] — спасибо");
        Models.ModelCalls.Should().Be(0);
    }

    [Test]
    public async Task A_slow_lookup_is_answered_in_time_with_a_hint_and_is_not_started_twice()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.Respond = async (_, _) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(10));
            return new Microsoft.Extensions.AI.ChatMessage(Microsoft.Extensions.AI.ChatRole.Assistant,
                """{"notTranslatable":true,"isVerb":false,"russianInfinitive":null}""");
        };

        var first = await Ask(920005, "кошка принесла котят");
        var again = await Ask(920005, "кошка принесла котят");

        first.Results.Should().BeEmpty();
        first.Button!.Text.Should().Be(InlineTranslation.PendingButtonText,
            because: "Telegram drops an answer after a few seconds, so the person is told the lookup goes on");
        again.Button!.Text.Should().Be(InlineTranslation.PendingButtonText);
        Models.ClassifierModel.Calls.Should().Be(1, because: "the second query waits for the lookup already running");
    }

    [Test]
    public async Task A_sent_card_is_acknowledged_without_writing_to_anybody()
    {
        using var client = App.CreateClient();
        var update = new Update
        {
            Id = 7999,
            ChosenInlineResult = new ChosenInlineResult
            {
                ResultId = "t",
                From = new global::Telegram.Bot.Types.User { Id = 920003, FirstName = "Test" },
                Query = "спасибо"
            }
        };

        var response = await client.PostAsync("/telegram/test_token", update.ToJsonContent());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        Telegram.Requests.OfType<SendMessageRequest>().Should().BeEmpty();
    }
}
