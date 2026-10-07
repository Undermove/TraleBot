using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Translation;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Translation;

/// <summary>
/// What the mini-app is told while a translation is running: the step the pipeline is really at. Each
/// test holds the pipeline at a step (a model or the dictionary site that has not answered yet) and
/// asks <c>translate/status</c> what it says.
/// </summary>
public class TranslationStagesTests : TranslationPipelineTestBase
{
    private const string NotAVerb = """{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""";
    private const string DanceIsAVerb = """{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""";

    private static readonly string[] VerbStages = ["verb-source", "verb-forms", "verb-review"];

    private static readonly JsonObject Dance =
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать");

    private static readonly string Lemma = Dance["lemma"]!.GetValue<string>();

    private long _telegramId;
    private readonly List<string> _seen = [];

    [SetUp]
    public async Task CreateLearner()
    {
        _seen.Clear();
        _telegramId = Random.Shared.NextInt64(1_000_000, 900_000_000);
        Options.MiniAppTranslateWaitMs = 50;
        // This fixture has its own application: a step held by a test must not be cut off by the short test timeouts.
        Options.ClassifierTimeoutSeconds = 30;
        Options.AnalystTimeoutSeconds = 30;
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var user = Create.User(_telegramId, "Learner");
            db.Users.Add(user);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
            await db.SaveChangesAsync(CancellationToken.None);
            return 0;
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

    private async Task<JsonNode> Call(string path, string word)
    {
        using var client = App.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/miniapp/{path}");
        request.Headers.Add("X-Telegram-Init-Data", InitData());
        request.Content = JsonContent.Create(new { word });
        var response = await client.SendAsync(request);
        response.IsSuccessStatusCode.Should().BeTrue($"{path} → {(int)response.StatusCode}");
        var answer = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        if (answer["status"]!.GetValue<string>() == "pending" && answer["stage"] != null)
        {
            _seen.Add(answer["stage"]!.GetValue<string>());
        }

        return answer;
    }

    /// <summary>A step of the pipeline that waits until the test lets it go on.</summary>
    private sealed class Gate
    {
        private readonly TaskCompletionSource _open = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _reached;

        public bool Reached => Volatile.Read(ref _reached) > 0;

        public Task Wait(CancellationToken ct = default)
        {
            Interlocked.Increment(ref _reached);
            return _open.Task.WaitAsync(ct);
        }

        public void Open() => _open.TrySetResult();
    }

    private readonly List<Gate> _gates = [];

    [TearDown]
    public void OpenGates()
    {
        _gates.ForEach(g => g.Open());
        _gates.Clear();
    }

    private Gate Hold(FakeChatClient model, string answer)
    {
        var gate = NewGate();
        model.Respond = async (_, ct) =>
        {
            await gate.Wait(ct);
            return new ChatMessage(ChatRole.Assistant, answer);
        };
        return gate;
    }

    private Gate NewGate()
    {
        var gate = new Gate();
        _gates.Add(gate);
        return gate;
    }

    /// <summary>The pipeline has stopped at the gate: what does the status say now?</summary>
    private async Task<JsonNode> StatusAt(Gate gate, string word)
    {
        await WaitUntil(() => gate.Reached);
        var status = await Call("translate/status", word);
        status["status"]!.GetValue<string>().Should().Be("pending");
        return status;
    }

    private async Task<JsonNode> Answer(string word)
    {
        JsonNode answer = null!;
        await WaitUntil(async () => (answer = await Call("translate/status", word))["status"]!.GetValue<string>() != "pending");
        return answer;
    }

    private static string Written() => JsonSerializer.Serialize(new
    {
        verdict = "verb", lemma = Lemma, masdar = Dance["title"]!.GetValue<string>(), russian = "танцевать",
        tenses = new[] { "present", "imperfect", "future", "conditional", "aorist", "optative" }
            .ToDictionary(t => t, t => Enumerable.Range(0, 6).Select(p => Form(Dance, t, p)).ToArray()),
        russianForms = new
        {
            inf = "танцевать", present = new[] { "танцую", "танцуешь", "танцует", "танцуем", "танцуете", "танцуют" },
            past = new { m = "танцевал", f = "танцевала", pl = "танцевали" }
        },
        matchedTense = "present", matchedPerson = 0
    });

    [Test]
    public async Task Ordinary_word_goes_from_recognizing_to_the_dictionaries_and_never_shows_a_verb_step()
    {
        await SeedCatalogWithout();
        var classifier = Hold(Models.ClassifierModel, NotAVerb);
        var site = NewGate();
        External.Before = () => site.Wait();

        var first = await Call("translate", "слива");
        first["status"]!.GetValue<string>().Should().Be("pending");

        var recognizing = await StatusAt(classifier, "слива");
        recognizing["stage"]!.GetValue<string>().Should().Be("recognizing");
        recognizing["verbLookup"]!.GetValue<bool>().Should().BeFalse();

        classifier.Open();
        var dictionaries = await StatusAt(site, "слива");
        dictionaries["stage"]!.GetValue<string>().Should().Be("dictionaries");
        dictionaries["verbLookup"]!.GetValue<bool>().Should().BeFalse();

        site.Open();
        var answer = await Answer("слива");
        answer["status"]!.GetValue<string>().Should().Be("success");
        answer["definition"]!.GetValue<string>().Should().Be(FakeExternalTranslator.Definition);
        _seen.Should().NotIntersectWith(VerbStages);
        Models.GeneratorModel.Calls.Should().Be(0);
    }

    [Test]
    public async Task Word_translated_without_models_reports_the_dictionaries_only()
    {
        await SeedCatalogWithout();
        Models.Configured = false;
        var site = NewGate();
        External.Before = () => site.Wait();

        await Call("translate", "слива");

        (await StatusAt(site, "слива"))["stage"]!.GetValue<string>().Should().Be("dictionaries");
        site.Open();
        (await Answer("слива"))["status"]!.GetValue<string>().Should().Be("success");
        _seen.Should().NotIntersectWith(VerbStages).And.NotContain("recognizing");
    }

    [Test]
    public async Task New_verb_goes_through_recognizing_writing_the_forms_and_the_review()
    {
        await SeedCatalogWithout(Lemma);
        Lexicon.Verbs.Add(new LexiconVerb(Lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        var classifier = Hold(Models.ClassifierModel, DanceIsAVerb);
        var generator = Hold(Models.GeneratorModel, Written());
        var reviewer = Hold(Models.ReviewerModel, """{"approve":true,"reasons":["ok"]}""");

        await Call("translate", "я танцую");

        (await StatusAt(classifier, "я танцую"))["stage"]!.GetValue<string>().Should().Be("recognizing");

        classifier.Open();
        var writing = await StatusAt(generator, "я танцую");
        writing["stage"]!.GetValue<string>().Should().Be("verb-forms");
        writing["verbLookup"]!.GetValue<bool>().Should().BeTrue();

        generator.Open();
        (await StatusAt(reviewer, "я танцую"))["stage"]!.GetValue<string>().Should().Be("verb-review");

        reviewer.Open();
        var answer = await Answer("я танцую");
        answer["status"]!.GetValue<string>().Should().Be("success");
        answer["verb"]!["verbId"]!.GetValue<string>().Should().Be(Lemma);
        _seen.Should().NotContain("dictionaries", because: "the old translator was not asked");
        External.Calls.Should().Be(0);
    }

    [Test]
    public async Task Verb_looked_up_in_the_source_is_reported_as_such_and_then_the_old_translator_as_the_dictionaries()
    {
        await SeedCatalogWithout();
        Models.CanGenerate = false;
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"глокать"}""");
        var analyst = Hold(Models.AnalystModel, """{"outcome":"none"}""");
        var site = NewGate();
        External.Before = () => site.Wait();

        await Call("translate", "глокать");

        var lookingUp = await StatusAt(analyst, "глокать");
        lookingUp["stage"]!.GetValue<string>().Should().Be("verb-source");
        lookingUp["verbLookup"]!.GetValue<bool>().Should().BeTrue();

        analyst.Open();
        (await StatusAt(site, "глокать"))["stage"]!.GetValue<string>().Should().Be("dictionaries");

        site.Open();
        var answer = await Answer("глокать");
        answer["status"]!.GetValue<string>().Should().Be("success");
        answer["definition"]!.GetValue<string>().Should().Be(FakeExternalTranslator.Definition);
        _seen.Should().NotContain("verb-forms").And.NotContain("verb-review");
    }

    [Test]
    public async Task Stage_does_not_go_back_when_the_reviewer_sends_the_verb_to_be_written_again()
    {
        await SeedCatalogWithout(Lemma);
        Lexicon.Verbs.Add(new LexiconVerb(Lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith(DanceIsAVerb);
        var rewriting = NewGate();
        var written = Written();
        Models.GeneratorModel.Respond = async (_, ct) =>
        {
            if (Models.GeneratorModel.Calls > 1)
            {
                await rewriting.Wait(ct);
            }

            return new ChatMessage(ChatRole.Assistant, written);
        };
        var reviews = 0;
        Models.ReviewerModel.Respond = (_, _) => Task.FromResult(new ChatMessage(
            ChatRole.Assistant,
            Interlocked.Increment(ref reviews) == 1 ? """{"approve":false,"reasons":["check the aorist"]}""" : """{"approve":true,"reasons":["ok"]}"""));

        await Call("translate", "я танцую");

        (await StatusAt(rewriting, "я танцую"))["stage"]!.GetValue<string>()
            .Should().Be("verb-review", because: "the second writing is part of the check; the step shown never moves back");

        rewriting.Open();
        (await Answer("я танцую"))["status"]!.GetValue<string>().Should().Be("success");
        Models.GeneratorModel.Calls.Should().Be(2);
    }

    [Test]
    public async Task Instance_that_does_not_run_the_translation_reports_no_stage()
    {
        await SeedCatalogWithout();

        var answer = await Call("translate/status", "стол");

        answer["status"]!.GetValue<string>().Should().Be("pending");
        answer["stage"].Should().BeNull(because: "the mini-app then keeps the step it knew");
    }

    [Test]
    public void Progress_keeps_the_furthest_stage_reported()
    {
        var progress = new TranslationProgress();
        progress.Stage.Should().Be(TranslationStage.Started);

        progress.Report(TranslationStage.VerbReview);
        progress.Report(TranslationStage.VerbForms);
        progress.Stage.Should().Be(TranslationStage.VerbReview);

        progress.Report(TranslationStage.Saving);
        progress.Stage.Should().Be(TranslationStage.Saving);
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
