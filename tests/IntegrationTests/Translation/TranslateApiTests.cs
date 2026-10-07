using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Translation;

/// <summary>
/// The mini-app's side of translation, over HTTP as the mini-app calls it: the <c>not_a_word</c> status,
/// and a model-made verb as a full citizen — the translation carries its parse, the card has the
/// phrases, the dictionary marks the saved word as a verb, a session is allowed.
/// </summary>
public class TranslateApiTests : TranslationPipelineTestBase
{
    private long _telegramId;
    private Guid _userId;

    [SetUp]
    public async Task CreateLearner()
    {
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

    /// <summary>initData signed the way Telegram signs it, with the test host's bot token.</summary>
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

    private async Task<JsonNode> Call(HttpMethod method, string path, object? body = null)
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

    [Test]
    public async Task Text_that_is_not_a_word_gets_the_not_a_word_status_and_nothing_is_saved()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":true,"isVerb":false,"russianInfinitive":null}""");
        External.Fails = true;

        var answer = await Call(HttpMethod.Post, "translate", new { word = "ываыва" });

        answer["status"]!.GetValue<string>().Should().Be("not_a_word");
        answer.AsObject().ContainsKey("definition").Should().BeFalse();
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VocabularyEntries.CountAsync(e => e.UserId == _userId))).Should().Be(0);
        (await Call(HttpMethod.Get, "vocabulary"))["items"]!.AsArray().Should().BeEmpty();
    }

    [Test]
    public async Task Ordinary_word_is_a_success_with_the_old_translation_and_no_verb()
    {
        await SeedCatalogWithout();
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""");

        var answer = await Call(HttpMethod.Post, "translate", new { word = "слива" });

        answer["status"]!.GetValue<string>().Should().Be("success");
        answer["definition"]!.GetValue<string>().Should().Be(FakeExternalTranslator.Definition);
        answer["verb"].Should().BeNull();
    }

    [Test]
    public async Task Model_made_verb_is_a_full_citizen_for_the_mini_app()
    {
        var dance = Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать");
        var lemma = dance["lemma"]!.GetValue<string>();
        await SeedCatalogWithout(lemma);
        Lexicon.Verbs.Add(new LexiconVerb(lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        string[] main = ["present", "imperfect", "future", "conditional", "aorist", "optative"];
        Models.GeneratorModel.AnswerWith(JsonSerializer.Serialize(new
        {
            verdict = "verb", lemma, masdar = dance["title"]!.GetValue<string>(), russian = "танцевать",
            tenses = main.ToDictionary(t => t, t => Enumerable.Range(0, 6).Select(p => Form(dance, t, p)).ToArray()),
            russianForms = new
            {
                inf = "танцевать", present = new[] { "танцую", "танцуешь", "танцует", "танцуем", "танцуете", "танцуют" },
                past = new { m = "танцевал", f = "танцевала", pl = "танцевали" }
            },
            matchedTense = "present", matchedPerson = 0
        }));
        Models.ReviewerModel.AnswerWith("""{"approve":true,"reasons":["ok"]}""");

        // The learner types «я танцую»: the verb is written, approved, stored — and the answer is its form.
        var translated = await Call(HttpMethod.Post, "translate", new { word = "я танцую" });

        translated["status"]!.GetValue<string>().Should().Be("success");
        translated["definition"]!.GetValue<string>().Should().Be(Form(dance, "present", 0));
        translated["verb"]!["verbId"]!.GetValue<string>().Should().Be(lemma);
        translated["verb"]!["meaning"]!.GetValue<string>().Should().Be("я танцую");

        // The card: the table with the phrase of every cell, marked as model-made.
        var id = Uri.EscapeDataString(lemma);
        var card = await Call(HttpMethod.Get, $"verbs/{id}");
        card["status"]!.GetValue<string>().Should().Be("generated");
        card["meanings"]!["aorist"]!.AsArray().Should().HaveCount(6);
        card["tenses"]!.AsObject().Select(t => t.Key).Should().BeEquivalentTo(main);

        // The dictionary: the saved word is that verb, and the verb is one of "my verbs".
        var vocabulary = await Call(HttpMethod.Get, "vocabulary");
        var entry = vocabulary["items"]!.AsArray().Should().ContainSingle().Subject!;
        entry["verb"]!["verbId"]!.GetValue<string>().Should().Be(lemma);
        vocabulary["verbs"]!.AsArray().Select(v => v!["id"]!.GetValue<string>()).Should().Contain(lemma);

        // Learning: a session is allowed, and a finished one is accepted and credited.
        var learning = await Call(HttpMethod.Get, $"verbs/{id}/learning");
        learning["progress"]!["canLearn"]!.GetValue<bool>().Should().BeTrue();
        learning["progress"]!["total"]!.GetValue<int>().Should().Be(36);
        var session = await Call(HttpMethod.Post, $"verbs/{id}/session", new
        {
            sessionId = Guid.NewGuid(), plan = new { scenes = new[] { new { type = "meet" } } }, scene = 0, done = 2,
            forms = new[] { new { tense = "present", person = 0, step = 3, reviews = 0, at = DateTime.UtcNow } },
            finished = true, scenes = new[] { "meet" }, storyCompleted = false, examAsked = 0, examCorrect = 0
        });
        session["xpEarned"]!.GetValue<int>().Should().BeGreaterThan(0);
        Models.ModelCalls.Should().Be(3, because: "one classifier call, one generation, one review — and nothing after");
    }

    // ── A verb the models take long to write: "pending", then the answer by translate/status ─────

    [Test]
    public async Task Slow_verb_is_pending_at_once_and_its_answer_is_picked_up_by_status()
    {
        var dance = Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать");
        var lemma = dance["lemma"]!.GetValue<string>();
        await SeedCatalogWithout(lemma);
        Options.MiniAppTranslateWaitMs = 100;
        Lexicon.Verbs.Add(new LexiconVerb(lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        string[] main = ["present", "imperfect", "future", "conditional", "aorist", "optative"];
        var written = JsonSerializer.Serialize(new
        {
            verdict = "verb", lemma, masdar = dance["title"]!.GetValue<string>(), russian = "танцевать",
            tenses = main.ToDictionary(t => t, t => Enumerable.Range(0, 6).Select(p => Form(dance, t, p)).ToArray()),
            russianForms = new
            {
                inf = "танцевать", present = new[] { "танцую", "танцуешь", "танцует", "танцуем", "танцуете", "танцуют" },
                past = new { m = "танцевал", f = "танцевала", pl = "танцевали" }
            },
            matchedTense = "present", matchedPerson = 0
        });
        var modelMayAnswer = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Models.GeneratorModel.Respond = async (_, ct) =>
        {
            await modelMayAnswer.Task.WaitAsync(ct);
            return new Microsoft.Extensions.AI.ChatMessage(Microsoft.Extensions.AI.ChatRole.Assistant, written);
        };
        Models.ReviewerModel.AnswerWith("""{"approve":true,"reasons":["ok"]}""");

        // The request does not wait for the model.
        var first = await Call(HttpMethod.Post, "translate", new { word = "я танцую" });
        first["status"]!.GetValue<string>().Should().Be("pending");

        // Asking again — the same request repeated, or the status — joins the work, it does not start another.
        await WaitUntil(() => Models.GeneratorModel.Calls > 0);
        (await Call(HttpMethod.Post, "translate", new { word = " Я танцую " }))["status"]!.GetValue<string>().Should().Be("pending");
        var waiting = await Call(HttpMethod.Post, "translate/status", new { word = "я танцую" });
        waiting["status"]!.GetValue<string>().Should().Be("pending");
        waiting["verbLookup"]!.GetValue<bool>().Should().BeTrue(because: "the mini-app says «ищу глагол» only for a verb");

        modelMayAnswer.SetResult();

        JsonNode answer = waiting;
        await WaitUntil(async () => (answer = await Call(HttpMethod.Post, "translate/status", new { word = "я танцую" }))["status"]!.GetValue<string>() != "pending");
        answer["status"]!.GetValue<string>().Should().Be("success");
        answer["definition"]!.GetValue<string>().Should().Be(Form(dance, "present", 0));
        answer["verb"]!["verbId"]!.GetValue<string>().Should().Be(lemma);

        // An instance that never had the job (here: the job is forgotten once answered) finds the saved word.
        var again = await Call(HttpMethod.Post, "translate/status", new { word = "я танцую" });
        again["status"]!.GetValue<string>().Should().Be("success");
        again["vocabularyEntryId"]!.GetValue<string>().Should().Be(answer["vocabularyEntryId"]!.GetValue<string>());
        (await Call(HttpMethod.Get, "vocabulary"))["items"]!.AsArray().Should().ContainSingle();
        Models.GeneratorModel.Calls.Should().Be(1);
    }

    [Test]
    public async Task Status_of_a_word_nobody_is_translating_is_pending_and_starts_nothing()
    {
        await SeedCatalogWithout();

        var answer = await Call(HttpMethod.Post, "translate/status", new { word = "стол" });

        answer["status"]!.GetValue<string>().Should().Be("pending");
        answer["verbLookup"]!.GetValue<bool>().Should().BeFalse();
        Models.ModelCalls.Should().Be(0);
        External.Calls.Should().Be(0);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VocabularyEntries.CountAsync(e => e.UserId == _userId))).Should().Be(0);
    }

    [Test]
    public async Task Slow_translation_that_ends_without_an_answer_is_a_failure_for_status()
    {
        await SeedCatalogWithout();
        Options.MiniAppTranslateWaitMs = 100;
        Models.Configured = false;
        External.Fails = true;
        var siteMayAnswer = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        External.Before = () => siteMayAnswer.Task;

        (await Call(HttpMethod.Post, "translate", new { word = "стол" }))["status"]!.GetValue<string>().Should().Be("pending");
        var waiting = await Call(HttpMethod.Post, "translate/status", new { word = "стол" });
        waiting["status"]!.GetValue<string>().Should().Be("pending");
        waiting["verbLookup"]!.GetValue<bool>().Should().BeFalse(because: "a slow dictionary site is not a verb being looked up");

        siteMayAnswer.SetResult();

        JsonNode answer = waiting;
        await WaitUntil(async () => (answer = await Call(HttpMethod.Post, "translate/status", new { word = "стол" }))["status"]!.GetValue<string>() != "pending");
        answer["status"]!.GetValue<string>().Should().Be("failure");
    }

    private static Task WaitUntil(Func<bool> condition) => WaitUntil(() => Task.FromResult(condition()));

    private static async Task WaitUntil(Func<Task<bool>> condition)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (!await condition())
        {
            (DateTime.UtcNow < deadline).Should().BeTrue("the condition should hold within 15 seconds");
            await Task.Delay(20);
        }
    }
}
