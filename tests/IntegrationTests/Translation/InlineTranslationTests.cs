using System.Net;
using FluentAssertions;
using Infrastructure.Telegram.Inline;
using IntegrationTests.Extensions;
using Telegram.Bot.Requests;
using Telegram.Bot.Types;
using Telegram.Bot.Types.InlineQueryResults;

namespace IntegrationTests.Translation;

/// <summary>
/// Inline mode for someone who writes with Georgians: «@bot …» in any chat. The options are plain texts
/// ready to send — the Russian of a Georgian message, the Georgian of a Russian one in Georgian or Latin
/// letters — and only those that differ from what was typed.
/// </summary>
public class InlineTranslationTests : TranslationPipelineTestBase
{
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

    private static IEnumerable<(string Title, string Sent)> Options(AnswerInlineQueryRequest answer) =>
        answer.Results.Cast<InlineQueryResultArticle>()
            .Select(a => (a.Title, ((InputTextMessageContent)a.InputMessageContent).MessageText));

    [Test]
    public async Task A_russian_message_is_offered_in_georgian_and_in_latin_letters_ready_to_send()
    {
        Models.ClassifierModel.AnswerWith("""{"georgian":"ხვალ ხუთზე მოვალ","latin":"xval xutze moval","russian":"Буду завтра в пять"}""");

        var answer = await Ask(920001, "Буду завтра в пять");

        Options(answer).Should().Equal(
            (InlineTranslation.GeorgianTitle, "ხვალ ხუთზე მოვალ"),
            (InlineTranslation.LatinTitle, "xval xutze moval"));
        answer.Results.Cast<InlineQueryResultArticle>().Should().OnlyContain(a => a.ReplyMarkup == null,
            because: "what goes to the chat is the text alone, as if the person had typed it");
        answer.Button!.StartParameter.Should().Be(InlineTranslation.StartParameter);
        answer.IsPersonal.Should().BeFalse(because: "a translation is the same for everybody, Telegram may reuse it");
        Models.ModelCalls.Should().Be(1, because: "Telegram waits a few seconds only: one fast call, not the dictionary pipeline");
    }

    [Test]
    public async Task Georgian_typed_in_latin_letters_gets_its_russian_and_its_georgian_letters()
    {
        Models.ClassifierModel.AnswerWith("""{"georgian":"ხვალ მოვალთ 5 საათზე","latin":"xval movalt 5 saatze","russian":"Завтра придём в 5 часов"}""");

        var answer = await Ask(920002, "xval movalt 5 saatze");

        Options(answer).Should().Equal(
            (InlineTranslation.RussianTitle, "Завтра придём в 5 часов"),
            (InlineTranslation.GeorgianLettersTitle, "ხვალ მოვალთ 5 საათზე"));
    }

    [Test]
    public async Task A_mixed_text_gets_every_option()
    {
        Models.ClassifierModel.AnswerWith("""{"georgian":"სად ხარ და კარგად, შენ?","latin":"sad xar da kargad, shen?","russian":"Где ты? И хорошо, а ты?"}""");

        var answer = await Ask(920003, "sad xar и kargad, shen?");

        Options(answer).Select(o => o.Title).Should().Equal(
            InlineTranslation.RussianTitle, InlineTranslation.GeorgianLettersTitle, InlineTranslation.LatinTitle);
    }

    [Test]
    public async Task English_gets_no_options()
    {
        Models.ClassifierModel.AnswerWith("""{"georgian":null,"latin":null,"russian":null}""");

        var answer = await Ask(920004, "where is the pharmacy");

        answer.Results.Should().BeEmpty();
        answer.Button!.Text.Should().Be(InlineTranslation.ButtonText);
    }

    [Test]
    public async Task Text_without_letters_gets_no_options_and_no_lookup()
    {
        var answer = await Ask(920005, "12345");

        answer.Results.Should().BeEmpty();
        Models.ModelCalls.Should().Be(0);
    }

    [Test]
    public async Task A_slow_lookup_is_answered_in_time_with_a_hint_and_is_not_started_twice()
    {
        Models.ClassifierModel.Respond = async (_, _) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(10));
            return new Microsoft.Extensions.AI.ChatMessage(Microsoft.Extensions.AI.ChatRole.Assistant,
                """{"georgian":null,"latin":null,"russian":null}""");
        };

        var first = await Ask(920006, "кошка принесла котят");
        var again = await Ask(920006, "кошка принесла котят");

        first.Results.Should().BeEmpty();
        first.Button!.Text.Should().Be(InlineTranslation.PendingButtonText,
            because: "Telegram drops an answer after a few seconds, so the person is told the lookup goes on");
        again.Button!.Text.Should().Be(InlineTranslation.PendingButtonText);
        Models.ClassifierModel.Calls.Should().Be(1, because: "the second query waits for the lookup already running");
    }

    [Test]
    public async Task A_sent_option_is_acknowledged_without_writing_to_anybody()
    {
        using var client = App.CreateClient();
        var update = new Update
        {
            Id = 7999,
            ChosenInlineResult = new ChosenInlineResult
            {
                ResultId = "ka",
                From = new global::Telegram.Bot.Types.User { Id = 920007, FirstName = "Test" },
                Query = "спасибо"
            }
        };

        var response = await client.PostAsync("/telegram/test_token", update.ToJsonContent());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        Telegram.Requests.OfType<SendMessageRequest>().Should().BeEmpty();
    }
}
