using System.Net;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Telegram.CommonComponents;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Telegram.Bot.Requests;

namespace IntegrationTests.Translation;

/// <summary>
/// The bot's reply to a translated word: when the word (or its translation) is a known verb form,
/// the reply ends with a parse line and starts its keyboard with a button to the verb card.
/// </summary>
public class TranslateCommandVerbReplyTests : TranslationPipelineTestBase
{
    private static readonly string Write =
        Catalog().Select(v => v!.AsObject()).Single(v => v["ru"]!.GetValue<string>() == "писать")["lemma"]!.GetValue<string>();

    private int _updateId = 5000;

    /// <summary>Sends a chat message to the bot through the webhook and returns the bot's last reply.</summary>
    private async Task<SendMessageRequest> Say(long userTelegramId, string text)
    {
        using var client = App.CreateClient();
        var response = await client.PostAsync(
            "/telegram/test_token", Create.TelegramUpdate(++_updateId, userTelegramId, text).ToJsonContent());
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return Telegram.Requests.OfType<SendMessageRequest>().Last();
    }

    [Test]
    public async Task Reply_to_a_verb_form_ends_with_the_parse_line()
    {
        await SeedCatalogWithout();
        var verb = CatalogVerb(Write);
        var form = Form(verb, "aorist", 3);
        var title = verb["title"]!.GetValue<string>();
        await Say(910001, "/start");

        var reply = await Say(910001, form);

        reply.Text.Should().StartWith("Определение: писать");
        reply.Text.Should().EndWith($"Разбор: {form} — «мы писали» (один раз · сделано). Глагол {title} — писать.",
            because: "the chat explains a form by what it means in plain Russian, not by the name of its tense");
    }

    [Test]
    public async Task Reply_to_a_russian_verb_names_the_verb_without_a_tense()
    {
        await SeedCatalogWithout();
        var title = CatalogVerb(Write)["title"]!.GetValue<string>();
        await Say(910002, "/start");

        var reply = await Say(910002, "писать");

        reply.Text.Should().StartWith($"Определение: {title}");
        reply.Text.Should().EndWith($"Глагол {title} — писать.");
        reply.Text.Should().NotContain("Разбор:");
    }

    [Test]
    public async Task Reply_to_a_word_that_is_not_a_verb_is_unchanged()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith("""{"isTranslationRequest":true,"isVerb":false,"language":"ru"}""");
        await Say(910003, "/start");

        var reply = await Say(910003, "стол");

        reply.Text.Should().Be(
            $"Определение: {FakeExternalTranslator.Definition}\nДругие значения: \nТранскрипция: [{FakeExternalTranslator.Definition}]\nПример употребления: ");
    }

    // The test host has no mini-app address (TraleTestApplication), so the keyboard row is checked on its own.
    [Test]
    public void Button_opens_the_mini_app_on_the_verb_card_at_the_parsed_form()
    {
        var verb = CatalogVerb(Write);
        var title = verb["title"]!.GetValue<string>();
        var hint = new VerbReplyHint(Write, title, "писать", VerbStatus.Verified, Form(verb, "aorist", 3), "aorist", 3);

        var button = VerbReplyFormatter.Button(hint, "https://tralebot.test/");

        button.Text.Should().Be($"Все формы: {title}");
        var link = new Uri(button.WebApp!.Url);
        link.GetLeftPart(UriPartial.Path).Should().Be("https://tralebot.test/");
        var query = System.Web.HttpUtility.ParseQueryString(link.Query);
        query["screen"].Should().Be("verb");
        query["verbId"].Should().Be(Write);
        query["tense"].Should().Be("aorist");
        query["person"].Should().Be("3");
    }

    [Test]
    public void Button_for_a_verb_without_a_parsed_form_links_to_the_verb_only()
    {
        var verb = CatalogVerb(Write);
        var hint = new VerbReplyHint(Write, verb["title"]!.GetValue<string>(), "писать", VerbStatus.Verified, null, null, null);

        VerbReplyFormatter.Button(hint, "https://tralebot.test").WebApp!.Url
            .Should().Be($"https://tralebot.test/?screen=verb&verbId={Uri.EscapeDataString(Write)}");
    }

    [Test]
    public void Parse_line_says_when_the_forms_are_unverified()
    {
        var verb = CatalogVerb(Write);
        var hint = new VerbReplyHint(
            Write, verb["title"]!.GetValue<string>(), "писать", VerbStatus.Generated, Form(verb, "present", 0), "present", 0);

        VerbReplyFormatter.Line(hint).Should().EndWith("Формы не проверены.");
        VerbReplyFormatter.Line(hint with { Status = VerbStatus.Verified }).Should().NotContain("не проверены");
    }

    [Test]
    public void Parse_line_without_a_stored_phrase_falls_back_to_the_person_and_a_plain_name_of_the_time()
    {
        var verb = CatalogVerb(Write);
        var title = verb["title"]!.GetValue<string>();
        var form = Form(verb, "aorist", 2);
        var hint = new VerbReplyHint(Write, title, "писать", VerbStatus.Verified, form, "aorist", 2);

        VerbReplyFormatter.Line(hint).Should().Be($"Разбор: {form} — «он/она · прошедшее: сделал». Глагол {title} — писать.");
        VerbReplyFormatter.Line(hint with { Meaning = "он писал" }).Should().Be($"Разбор: {form} — «он писал». Глагол {title} — писать.");
    }

    [Test]
    public void Parse_line_never_names_a_tense_by_its_textbook_term()
    {
        var verb = CatalogVerb(Write);
        var terms = new[] { "аорист", "имперфект", "оптатив", "конъюнктив", "перфект", "масдар" };
        foreach (var tense in verb["tenses"]!.AsObject().Select(t => t.Key))
        {
            var hint = new VerbReplyHint(Write, verb["title"]!.GetValue<string>(), "писать", VerbStatus.Verified, Form(verb, tense, 0), tense, 0);

            var line = VerbReplyFormatter.Line(hint).ToLowerInvariant();

            terms.Should().NotContain(term => line.Contains(term), because: $"tense '{tense}' must be said in plain words");
        }
    }
}
