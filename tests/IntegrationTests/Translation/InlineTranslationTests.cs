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
    public async Task Text_that_is_neither_russian_nor_georgian_gets_no_cards_and_no_lookup()
    {
        await SeedCatalogWithout();

        var answer = await Ask(920002, "hello");

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
