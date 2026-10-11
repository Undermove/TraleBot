using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Application.Common;
using Application.Translation.Languages;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Telegram.CommonComponents;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot.Requests;

namespace IntegrationTests.Translation;

/// <summary>
/// A word that is a verb of the base is answered with the verb card, in the bot and in the mini-app:
/// a Russian infinitive — the name of the action and the key forms; a Georgian form — what exactly it
/// says, in plain words, and whose it is. Anything else is answered as before. The words are the ones
/// the owner typed on prod; every Georgian form is checked against the catalog.
/// </summary>
public class VerbTranslationCardTests : TranslationPipelineTestBase
{
    private static JsonObject VerbFor(string russian) =>
        Catalog().Select(v => v!.AsObject()).Single(v => v["ru"]!.GetValue<string>() == russian);

    private static string Cyr(string georgian) => GeorgianTranscriptionExtension.GetTranscription(georgian);

    private static string Lemma(JsonObject verb) => verb["lemma"]!.GetValue<string>();
    private static string Title(JsonObject verb) => verb["title"]!.GetValue<string>();

    private int _updateId = 7000;
    private long _telegramId;
    private Guid _userId;

    [SetUp]
    public async Task Prepare()
    {
        await SeedCatalogWithout();
        Models.Configured = false;
        _telegramId = Random.Shared.NextInt64(1_000_000, 900_000_000);
        _userId = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var user = Create.User(_telegramId, "Learner");
            db.Users.Add(user);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
            await db.SaveChangesAsync(CancellationToken.None);
            return user.Id;
        });
    }

    /// <summary>Sends a chat message to the bot through the webhook and returns the bot's last reply.</summary>
    private async Task<SendMessageRequest> Say(string text)
    {
        using var client = App.CreateClient();
        var response = await client.PostAsync(
            "/telegram/test_token", Create.TelegramUpdate(++_updateId, _telegramId, text).ToJsonContent());
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return Telegram.Requests.OfType<SendMessageRequest>().Last();
    }

    private string InitData()
    {
        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["auth_date"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
            ["query_id"] = "test",
            ["user"] = JsonSerializer.Serialize(new { id = _telegramId, first_name = "Learner" })
        };
        var check = string.Join("\n", fields.Select(f => $"{f.Key}={f.Value}"));
        var secret = HMACSHA256.HashData(Encoding.UTF8.GetBytes("WebAppData"), Encoding.UTF8.GetBytes(BotToken));
        fields["hash"] = Convert.ToHexString(HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(check))).ToLowerInvariant();
        return string.Join("&", fields.Select(f => $"{f.Key}={Uri.EscapeDataString(f.Value)}"));
    }

    /// <summary>A call of the mini-app's API, signed as the learner.</summary>
    private async Task<JsonNode> Api(HttpMethod method, string path, object? body = null)
    {
        using var client = App.CreateClient();
        using var request = new HttpRequestMessage(method, $"/api/miniapp/{path}");
        request.Headers.Add("X-Telegram-Init-Data", InitData());
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }

        var response = await client.SendAsync(request);
        response.IsSuccessStatusCode.Should().BeTrue($"{method} {path} → {(int)response.StatusCode}");
        return JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
    }

    private Task<VocabularyEntry?> Saved(string word) => InScope(sp => sp.GetRequiredService<ITraleDbContext>()
        .VocabularyEntries.AsNoTracking().FirstOrDefaultAsync(e => e.UserId == _userId && e.Word == word));

    private Task<VerbTranslationCard?> Card(string text) =>
        InScope(sp => sp.GetRequiredService<VerbTranslationCardQuery>().FindAsync(text, CancellationToken.None));

    // ── 1. A Russian infinitive of the base ──────────────────────────────────────────────────────

    [Test]
    public async Task Byt_is_answered_with_the_name_of_the_action_and_the_forms_and_not_with_one_form_passed_for_the_infinitive()
    {
        var be = VerbFor("быть");
        var (i, he, will, was) = (Form(be, "present", 0), Form(be, "present", 2), Form(be, "future", 0), Form(be, "aorist", 0));
        Title(be).Should().NotBe(Lemma(be), "the catalog names the action of «быть»");

        var reply = await Say("быть");

        reply.Text.Should().StartWith(
            "Глагол «быть»\n\n"
            + $"Название действия: {Title(be)} [{Cyr(Title(be))}]\n\n"
            + $"я есть — {i} [{Cyr(i)}]\n"
            + $"он есть — {he} [{Cyr(he)}]\n"
            + $"я буду — {will} [{Cyr(will)}]\n"
            + $"я был(а) — {was} [{Cyr(was)}]\n");
        reply.Text.Should().EndWith($"В словарь записано: быть — {Title(be)}");
        reply.Text.Should().NotContain("названия действия для этого глагола в базе пока нет");
        (await Saved("быть"))!.Definition.Should().Be(Title(be), because: "the dictionary keeps the name of the action, not «он есть»");
        External.Calls.Should().Be(0);
    }

    [Test]
    public void Every_catalog_verb_has_a_name_of_the_action_of_its_own()
    {
        Catalog().Select(v => v!.AsObject()).Where(v => Title(v) == Lemma(v)).Select(v => v["ru"]!.GetValue<string>())
            .Should().BeEmpty("a card title that repeats the dictionary form is «он …» passed for the name of the action");
    }

    [Test]
    public async Task Verb_the_base_has_no_name_of_the_action_for_is_saved_as_its_dictionary_form_and_the_reply_says_so()
    {
        // No catalog verb is like that any more; a verb stored at runtime can be (its title falls back to the lemma).
        var dance = VerbFor("танцевать");
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var row = await db.Verbs.FirstAsync(v => v.Lemma == Lemma(dance));
            row.Title = row.Lemma;
            await db.SaveChangesAsync(CancellationToken.None);
            return 0;
        });

        var reply = await Say("танцевать");

        reply.Text.Should().StartWith($"Глагол «танцевать»\n\nя танцую — ");
        reply.Text.Should().NotContain("Название действия");
        reply.Text.Should().EndWith(
            $"В словарь записано: танцевать — {Lemma(dance)} (это «он танцует»; названия действия для этого глагола в базе пока нет)");
        (await Saved("танцевать"))!.Definition.Should().Be(Lemma(dance));
    }

    [Test]
    public async Task Hodit_gets_the_name_of_the_action_and_the_forms_the_base_has_and_the_dictionary_keeps_the_name()
    {
        var walk = VerbFor("ходить");
        var (i, he, past) = (Form(walk, "present", 0), Form(walk, "present", 2), Form(walk, "imperfect", 0));
        walk["tenses"]!.AsObject().ContainsKey("future").Should().BeFalse("the test relies on the base having no future for this verb");

        var reply = await Say("ходить");

        reply.Text.Should().StartWith(
            "Глагол «ходить»\n\n"
            + $"Название действия: {Title(walk)} [{Cyr(Title(walk))}]\n\n"
            + $"я хожу — {i} [{Cyr(i)}]\n"
            + $"он ходит — {he} [{Cyr(he)}]\n"
            + $"я ходил(а) — {past} [{Cyr(past)}]");
        reply.Text.Should().EndWith($"В словарь записано: ходить — {Title(walk)}");
        var saved = await Saved("ходить");
        saved!.Definition.Should().Be(Title(walk));
        saved.AdditionalInfo.Should().StartWith($"название действия; «я хожу» — {i}; «он ходит» — {he}");
    }

    [Test]
    public async Task Zhelat_is_the_verb_and_not_the_noun()
    {
        var wish = VerbFor("желать");

        var reply = await Say("желать");

        reply.Text.Should().StartWith($"Глагол «желать»\n\nНазвание действия: {Title(wish)} [{Cyr(Title(wish))}]\n\nя желаю — ");
        reply.Text.Should().Contain($"он желает — {Lemma(wish)} [{Cyr(Lemma(wish))}]");
        (await Saved("желать"))!.Definition.Should().Be(Title(wish));
    }

    [Test]
    public async Task Verbs_that_are_the_same_word_with_a_clarification_are_named_under_the_card()
    {
        var card = await Card("писать");

        card!.Verbs.Should().ContainSingle().Which.Translation.Should().Be("писать");
        card.Related.Should().Equal("писать (кому-то)", "писать (на чём-то)");
        VerbCardReplyFormatter.Text(card, "писать", "…", null, alreadySaved: false)
            .Should().Contain("\n\nЕщё в разделе «Глаголы»: «писать (кому-то)», «писать (на чём-то)».\n\n");
    }

    [TestCase("  БЫТЬ ")]
    [TestCase("Быть.")]
    [TestCase("быть")]
    public async Task Case_spaces_and_punctuation_around_the_word_do_not_matter(string typed)
    {
        var card = await Card(typed);

        card!.Kind.Should().Be(VerbCardKind.Infinitive);
        card.Verbs.Should().ContainSingle().Which.Lemma.Should().Be(Lemma(VerbFor("быть")));
    }

    [Test]
    public async Task Yo_typed_as_ye_and_the_other_way_round_is_the_same_word()
    {
        // No catalog gloss has «ё» today; a verb stored at runtime may. The comparison is the base's own.
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            (await db.Verbs.FirstAsync(v => v.Translation == "печь")).Translation = "печь, пёчь";
            await db.SaveChangesAsync(CancellationToken.None);
            return 0;
        });

        (await Card("пёчь"))!.Verbs.Single().Lemma.Should().Be(Lemma(VerbFor("печь")));
        (await Card("печь"))!.Verbs.Single().Lemma.Should().Be(Lemma(VerbFor("печь")));
    }

    [Test]
    public async Task Infinitive_with_several_verbs_lists_them_all_each_with_its_forms()
    {
        var both = Catalog().Select(v => v!.AsObject())
            .Where(v => v["ru"]!.GetValue<string>().Split(',', StringSplitOptions.TrimEntries).Contains("открывать")).ToList();
        both.Should().HaveCount(2);

        var reply = await Say("открывать");

        reply.Text.Should().StartWith("«открывать» — в базе 2 глагола:\n\n");
        for (var n = 0; n < both.Count; n++)
        {
            var i = Form(both[n], "present", 0);
            reply.Text.Should().Contain($"{n + 1}. {Title(both[n])} [{Cyr(Title(both[n]))}] — открывать\nя открываю — {i} [{Cyr(i)}]\n");
        }

        (await Saved("открывать"))!.Definition.Should().Be(Title(both[0]), because: "the first verb is the more common one");

        var buttons = VerbCardReplyFormatter.Buttons((await Card("открывать"))!, "https://tralebot.test/").ToList();
        buttons.Select(b => b.Text).Should().Equal("Открыть в глаголах: «открывать»", "Открыть в глаголах: «открывать»");
        buttons.Select(b => b.WebApp!.Url).Should().Equal(
            both.Select(v => $"https://tralebot.test/?screen=verb&verbId={Uri.EscapeDataString(Lemma(v))}"));
    }

    // ── 2. A Georgian form of the base ───────────────────────────────────────────────────────────

    [Test]
    public async Task Viqo_is_explained_as_the_form_it_is_with_the_phrase_the_base_has_for_it()
    {
        var be = VerbFor("быть");
        const string typed = "ვიყო";
        Form(be, "optative", 0).Should().Be(typed);

        var reply = await Say(typed);

        reply.Text.Should().StartWith(
            $"{typed} [{Cyr(typed)}] — «мне надо быть»\n"
            + "Форма: «чтобы я…» — так говорят после «надо», «хочу».\n"
            + $"Глагол «быть», название действия: {Title(be)} [{Cyr(Title(be))}].");
        (await Saved(typed))!.Definition.Should().Be("мне надо быть");
    }

    [Test]
    public async Task Vpoulob_is_the_present_i_find_and_not_a_past()
    {
        var find = VerbFor("находить");
        const string typed = "ვპოულობ";
        Form(find, "present", 0).Should().Be(typed);

        var reply = await Say(typed);

        reply.Text.Should().StartWith(
            $"{typed} [{Cyr(typed)}] — «я нахожу»\n"
            + "Форма: я, настоящее время.\n"
            + $"Глагол «находить», название действия: {Title(find)} [{Cyr(Title(find))}].");
        reply.Text.Should().EndWith($"В словарь записано: {typed} — я нахожу");
        (await Saved(typed))!.Definition.Should().Be("я нахожу");
    }

    [Test]
    public async Task Form_with_two_readings_shows_both_and_the_past_goes_before_the_form_after_nado()
    {
        var be = VerbFor("быть");
        var form = Form(be, "aorist", 2);
        Form(be, "optative", 1).Should().Be(form, "the test relies on «он был» and «чтобы ты…» being spelled alike");

        var reply = await Say(form);

        reply.Text.Should().StartWith(
            $"{form} [{Cyr(form)}] — у этого слова несколько значений:\n\n"
            + $"Глагол «быть», название действия: {Title(be)} [{Cyr(Title(be))}]\n"
            + "• «он был» · он/она, прошедшее время: сделал один раз\n"
            + "• «тебе надо быть» · «чтобы ты…» — так говорят после «надо», «хочу»");
        (await Saved(form))!.Definition.Should().Be("он был", because: "the dictionary keeps the first reading of the card");
    }

    [Test]
    public async Task Form_that_belongs_to_several_verbs_names_each_of_them()
    {
        var plain = VerbFor("писать");
        var toSomeone = VerbFor("писать (кому-то)");
        var form = Form(plain, "present", 0);
        Form(toSomeone, "present", 0).Should().Be(form);

        var card = await Card(form);

        card!.Kind.Should().Be(VerbCardKind.Form);
        card.Verbs.Select(v => v.Translation).Should().Equal("писать", "писать (кому-то)");
        card.Verbs.Should().OnlyContain(v => v.Lines.Count == 1 && v.Lines[0].Meaning != null);
        var text = VerbCardReplyFormatter.Text(card, form, "я пишу", null, alreadySaved: false);
        text.Should().Contain("Глагол «писать», название действия: ").And.Contain("Глагол «писать (кому-то)», название действия: ");
    }

    [Test]
    public async Task Name_of_an_action_typed_in_georgian_lists_the_verbs_it_names()
    {
        var take = VerbFor("брать");
        var open = Catalog().Select(v => v!.AsObject()).Single(v => Title(v) == Title(take) && Lemma(v) != Lemma(take));
        open["ru"]!.GetValue<string>().Should().Be("открывать", "the test relies on two verbs sharing the name of the action");

        var card = await Card(Title(take));

        card!.Kind.Should().Be(VerbCardKind.ActionName);
        card.Verbs.Select(v => v.Lemma).Should().Equal(Lemma(take), Lemma(open));
        VerbCardReplyFormatter.Text(card, Title(take), "брать", null, alreadySaved: true)
            .Should().StartWith($"{Title(take)} [{Cyr(Title(take))}] — название действия. Так называются 2 глагола:\n\n1. «брать» — ")
            .And.EndWith($"Уже в словаре: {Title(take)} — брать");
    }

    [Test]
    public async Task Walking_and_going_have_names_of_the_action_of_their_own()
    {
        var go = VerbFor("идти, уходить");
        var walk = VerbFor("ходить");
        Title(walk).Should().NotBe(Title(go));

        (await Card(Title(walk)))!.Verbs.Should().ContainSingle().Which.Lemma.Should().Be(Lemma(walk));
        (await Card(Title(go)))!.Verbs.Should().ContainSingle().Which.Lemma.Should().Be(Lemma(go));
    }

    // ── 3. Not a verb of the base: as before ─────────────────────────────────────────────────────

    [Test]
    public async Task Word_that_is_not_in_the_base_is_answered_exactly_as_before()
    {
        var reply = await Say("стол");

        reply.Text.Should().Be(
            $"Определение: {FakeExternalTranslator.Definition}\nДругие значения: \nТранскрипция: [{FakeExternalTranslator.Definition}]\nПример употребления: ");
        (await Card("стол")).Should().BeNull();
        (await Card("хочу быть")).Should().BeNull("a phrase is not a card: it is translated as before");
        (await Card("ываыва")).Should().BeNull();
        (await Card("to be")).Should().BeNull();

        var api = await Api(HttpMethod.Post, "translate", new { word = "слива" });
        api["status"]!.GetValue<string>().Should().Be("success");
        api["definition"]!.GetValue<string>().Should().Be(FakeExternalTranslator.Definition);
        api["verbCard"].Should().BeNull();
    }

    [Test]
    public async Task Russian_word_of_a_learner_of_another_language_gets_no_georgian_card()
    {
        var query = App.Services.CreateScope().ServiceProvider.GetRequiredService<VerbTranslationCardQuery>();

        (await query.FindForAsync("быть", Language.English, CancellationToken.None)).Should().BeNull();
        (await query.FindForAsync("быть", Language.Georgian, CancellationToken.None)).Should().NotBeNull();
        (await query.FindForAsync("ვიყო", Language.English, CancellationToken.None)).Should().NotBeNull("a Georgian word is Georgian for everyone");
    }

    // ── The same word again; the mini-app; the dictionary ────────────────────────────────────────

    [Test]
    public async Task Word_already_in_the_dictionary_gets_the_same_card_and_says_what_is_kept()
    {
        await Say("ходить");

        var again = await Say("Ходить");

        again.Text.Should().StartWith("Глагол «ходить»\n\nНазвание действия: ");
        again.Text.Should().EndWith($"Уже в словаре: ходить — {Title(VerbFor("ходить"))}");
    }

    [Test]
    public async Task Mini_app_gets_the_card_and_the_saved_infinitive_is_a_verb_of_the_dictionary()
    {
        var walk = VerbFor("ходить");

        var answer = await Api(HttpMethod.Post, "translate", new { word = "Ходить" });

        answer["status"]!.GetValue<string>().Should().Be("success");
        answer["definition"]!.GetValue<string>().Should().Be(Title(walk));
        var card = answer["verbCard"]!;
        card["kind"]!.GetValue<string>().Should().Be("infinitive");
        var verb = card["verbs"]!.AsArray().Should().ContainSingle().Subject!;
        verb["verbId"]!.GetValue<string>().Should().Be(Lemma(walk));
        verb["actionName"]!.GetValue<string>().Should().Be(Title(walk));
        verb["actionNameTranscription"]!.GetValue<string>().Should().Be(Cyr(Title(walk)));
        var lines = verb["lines"]!.AsArray();
        lines.Select(l => l!["meaning"]!.GetValue<string>()).Should().Equal("я хожу", "он ходит", "я ходил(а)");
        lines[0]!["forms"]![0]!["form"]!.GetValue<string>().Should().Be(Form(walk, "present", 0));
        lines[0]!["forms"]![0]!["transcription"]!.GetValue<string>().Should().Be(Cyr(Form(walk, "present", 0)));

        var item = (await Api(HttpMethod.Get, "vocabulary"))["items"]!.AsArray().Should().ContainSingle().Subject!;
        item["verb"]!["verbId"]!.GetValue<string>().Should().Be(Lemma(walk));
        item["verb"]!["actionName"]!.GetValue<bool>().Should().BeTrue();
        item["verb"]!["single"]!.GetValue<bool>().Should().BeTrue();
        item["verb"]!["meaning"]!.GetValue<string>().Should().Be("название действия");
    }

    [Test]
    public async Task Mini_app_gets_the_card_of_a_georgian_form()
    {
        var find = VerbFor("находить");
        var form = Form(find, "present", 0);

        var answer = await Api(HttpMethod.Post, "translate", new { word = form });

        answer["definition"]!.GetValue<string>().Should().Be("я нахожу");
        var card = answer["verbCard"]!;
        card["kind"]!.GetValue<string>().Should().Be("form");
        card["transcription"]!.GetValue<string>().Should().Be(Cyr(form));
        var line = card["verbs"]![0]!["lines"]!.AsArray().Should().ContainSingle().Subject!;
        line["meaning"]!.GetValue<string>().Should().Be("я нахожу");
        line["caption"]!.GetValue<string>().Should().Be("я, настоящее время");
        (line["tense"]!.GetValue<string>(), line["person"]!.GetValue<int>()).Should().Be(("present", 0));
    }

    [Test]
    public async Task Entry_whose_name_of_the_action_two_verbs_share_is_tied_to_the_verb_its_russian_side_names()
    {
        var take = VerbFor("брать");
        var open = Catalog().Select(v => v!.AsObject()).First(v => Title(v) == Title(take) && Lemma(v) != Lemma(take));

        await Api(HttpMethod.Post, "translate", new { word = "открывать" });

        var item = (await Api(HttpMethod.Get, "vocabulary"))["items"]!.AsArray().Should().ContainSingle().Subject!;
        item["definition"]!.GetValue<string>().Should().Be(Title(take));
        item["verb"]!["verbId"]!.GetValue<string>().Should().Be(Lemma(open), because: "«брать» comes first in the catalog, but the entry says «открывать»");
    }

    [Test]
    public async Task Noun_saved_as_a_noun_is_not_marked_as_a_verb_even_when_it_is_spelled_like_the_name_of_an_action()
    {
        var play = VerbFor("играть");
        Title(play).Should().NotBe(Lemma(play));
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            foreach (var russian in new[] { "игра", "играть" })
            {
                db.VocabularyEntries.Add(new VocabularyEntry
                {
                    Id = Guid.NewGuid(), UserId = _userId, Word = russian, Definition = Title(play), AdditionalInfo = "", Example = "",
                    Language = Language.Georgian, DateAddedUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow
                });
            }

            await db.SaveChangesAsync(CancellationToken.None);
            return 0;
        });

        var items = (await Api(HttpMethod.Get, "vocabulary"))["items"]!.AsArray();

        items.Single(i => i!["word"]!.GetValue<string>() == "игра")!["verb"].Should().BeNull();
        items.Single(i => i!["word"]!.GetValue<string>() == "играть")!["verb"]!["verbId"]!.GetValue<string>().Should().Be(Lemma(play));
    }

    // ── The whole catalog ────────────────────────────────────────────────────────────────────────

    [Test]
    public async Task Every_catalog_verb_has_a_card_with_cyrillic_transcription_only_and_no_textbook_terms()
    {
        var terms = new[] { "масдар", "аорист", "имперфект", "оптатив", "конъюнктив", "перфект", "инфинитив", "спряжени" };
        var latin = new Regex("[A-Za-z]");

        foreach (var verb in Catalog().Select(v => v!.AsObject()))
        {
            var texts = new List<string>();
            // A gloss with a clarification — «писать (кому-то)» — is another verb than the plain word and is not asked by it.
            var gloss = verb["ru"]!.GetValue<string>().Split(',', StringSplitOptions.TrimEntries).FirstOrDefault(g => !g.Contains('('));
            if (gloss != null)
            {
                var card = await Card(gloss);
                card.Should().NotBeNull($"«{gloss}» is a gloss of the catalog");
                var mine = card!.Verbs.Single(v => v.Lemma == Lemma(verb));
                // «я делаю» and «он делает» at the least, and every form is the catalog's own.
                mine.Lines.Count(l => l.Tense == "present").Should().Be(2, $"«{gloss}» has both present forms");
                foreach (var line in mine.Lines)
                {
                    line.Variants.Should().Equal(verb["tenses"]![line.Tense]![line.Person]!.AsArray().Select(f => f!.GetValue<string>()));
                    line.Meaning.Should().Be(verb["meanings"]![line.Tense]![line.Person]!.GetValue<string>());
                }

                texts.Add(VerbCardReplyFormatter.Text(card, gloss, mine.ActionName ?? mine.Lemma, null, alreadySaved: false));
            }

            foreach (var tense in verb["tenses"]!.AsObject().Select(t => t.Key))
            {
                var form = Form(verb, tense, 0);
                var formCard = await Card(form);
                // The lemma of «хотеть» is kept out of the form index on purpose (it is also «надо»).
                if (formCard != null)
                {
                    texts.Add(VerbCardReplyFormatter.Text(formCard, form, "…", null, alreadySaved: false));
                }
            }

            foreach (var text in texts)
            {
                latin.IsMatch(text).Should().BeFalse($"no Latin transcription in the card:\n{text}");
                terms.Should().NotContain(term => text.ToLowerInvariant().Contains(term), $"plain words only:\n{text}");
            }
        }
    }
}
