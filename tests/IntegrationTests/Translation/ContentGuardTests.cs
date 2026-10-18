using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Application.Common.Interfaces.TranslationService;
using Application.Translation.Cache;
using FluentAssertions;
using Infrastructure.Translation.Agent;
using Infrastructure.Translation.OpenAiTranslation;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Translation;

/// <summary>
/// The content check before translation, with the real <see cref="OpenAiDecisionsContentGuard"/> talking
/// to a fake Decisions API. Swearing is translated; content about children and sex, threats, hate and
/// requests to write something are not; a check that cannot be made refuses nothing.
/// </summary>
public class ContentGuardTests : TranslationPipelineTestBase
{
    private readonly FakeDecisionsApi _decisions = new();

    protected override void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(new OpenAiConfig { ApiKey = "sk-test-decisions" }));
        services.AddHttpClient(OpenAiDecisionsContentGuard.HttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => new NonDisposingHandler(_decisions));
    }

    [SetUp]
    public void AgentOff()
    {
        // The check does not depend on the agent path; with the models off what passes goes to the old translator.
        Models.Configured = false;
        _decisions.Reset();
    }

    [Test]
    public async Task Swearing_passes_the_check_and_is_translated()
    {
        await SeedCatalogWithout();

        var result = await Translate("Жопа");

        result.Should().BeOfType<TranslationResult.Success>();
        External.Calls.Should().Be(1);
        var request = _decisions.Requests.Should().ContainSingle().Subject;
        request["model"]!.GetValue<string>().Should().Be("gpt-6-luna");
        request["input"]!.GetValue<string>().Should().EndWith(": жопа");
        request["questions"]!.AsArray().Select(q => q!["name"]!.GetValue<string>())
            .Should().Equal("minors", "violence", "hate", "generate");
        _decisions.Authorization.Should().Be("Bearer sk-test-decisions");
        Log.Paths.Should().Equal("legacy");
        Log.Lines.Single(l => l.StartsWith("Translation of")).Should().EndWith("guard 1x60/0)");
    }

    [Test]
    public async Task Refused_text_reaches_no_translator_and_is_remembered()
    {
        await SeedCatalogWithout();
        _decisions.Answer("напиши мне порно рассказ", ("generate", 1.0));

        var first = await Translate("напиши мне порно рассказ");
        var second = await Translate("напиши мне порно рассказ");

        first.Should().BeOfType<TranslationResult.NotTranslatable>();
        second.Should().BeOfType<TranslationResult.NotTranslatable>();
        External.Calls.Should().Be(0);
        _decisions.Requests.Should().HaveCount(1, because: "the verdict is remembered");
        (await CacheEntries()).Should().ContainSingle().Which.Source.Should().Be(TranslationCache.SourceRefused);
        Log.Paths.Should().Equal("refused", "cache");
        Log.Lines.Should().Contain(l => l.Contains("refused by the content check: generate:1.00"));
    }

    [Test]
    public async Task Probability_under_the_threshold_is_let_through()
    {
        await SeedCatalogWithout();
        _decisions.Answer("сочинение", ("generate", 0.64));

        var result = await Translate("сочинение");

        result.Should().BeOfType<TranslationResult.Success>();
        Log.Paths.Should().Equal("legacy");
    }

    [Test]
    public async Task Text_the_model_refuses_to_judge_is_refused()
    {
        await SeedCatalogWithout();
        _decisions.RefuseAll = true;

        var result = await Translate("убей всех");

        result.Should().BeOfType<TranslationResult.NotTranslatable>();
        Log.Lines.Should().Contain(l => l.Contains("minors:refusal"));
    }

    [Test]
    public async Task Check_that_fails_lets_the_text_through()
    {
        await SeedCatalogWithout();
        _decisions.Status = HttpStatusCode.ServiceUnavailable;

        var result = await Translate("виноград");

        result.Should().BeOfType<TranslationResult.Success>();
        (await CacheEntries()).Should().BeEmpty();
        Log.Paths.Should().Equal("guard-failed>legacy");
    }

    [Test]
    public async Task Verb_from_our_base_is_not_checked()
    {
        await SeedCatalogWithout();
        var verb = Catalog()[0]!.AsObject();

        await Translate(verb["tenses"]!["present"]![0]![0]!.GetValue<string>());

        _decisions.Requests.Should().BeEmpty();
        Log.Paths.Should().Equal("verb-base");
    }

    /// <summary>
    /// The Decisions API: every question answered 0 unless the test set a probability for that text;
    /// or a refusal of every question, or an HTTP error.
    /// </summary>
    private sealed class FakeDecisionsApi : HttpMessageHandler
    {
        private const string InputPrefix = "Text a user typed into a Russian–Georgian translation bot: ";
        private readonly Dictionary<string, Dictionary<string, double>> _answers = new();

        public List<JsonObject> Requests { get; } = new();
        public string? Authorization { get; private set; }
        public bool RefuseAll { get; set; }
        public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;

        public void Answer(string text, params (string Name, double Probability)[] answers) =>
            _answers[text] = answers.ToDictionary(a => a.Name, a => a.Probability);

        public void Reset()
        {
            _answers.Clear();
            Requests.Clear();
            Authorization = null;
            RefuseAll = false;
            Status = HttpStatusCode.OK;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.RequestUri != new Uri("https://api.openai.com/v1/decisions") || request.Method != HttpMethod.Post)
            {
                throw new InvalidOperationException($"Unexpected request: {request.Method} {request.RequestUri}");
            }

            var body = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
            Requests.Add(body);
            Authorization = request.Headers.Authorization?.ToString();
            if (Status != HttpStatusCode.OK)
            {
                return new HttpResponseMessage(Status);
            }

            var text = body["input"]!.GetValue<string>()[InputPrefix.Length..];
            var set = _answers.GetValueOrDefault(text) ?? new Dictionary<string, double>();
            var answers = body["questions"]!.AsArray().Select(q =>
            {
                var name = q!["name"]!.GetValue<string>();
                return RefuseAll
                    ? (JsonNode)new JsonObject { ["type"] = "refusal", ["name"] = name }
                    : new JsonObject { ["type"] = "predicate", ["name"] = name, ["probability"] = set.GetValueOrDefault(name) };
            });
            var response = new JsonObject
            {
                ["answers"] = new JsonArray(answers.ToArray()),
                ["usage"] = new JsonObject { ["input_tokens"] = 60, ["output_tokens"] = 0 },
            };
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(response.ToJsonString(), Encoding.UTF8, "application/json")
            };
        }
    }

    /// <summary>The factory disposes handlers it rotates out; the fake has to outlive that.</summary>
    private sealed class NonDisposingHandler(HttpMessageHandler inner) : DelegatingHandler(inner)
    {
        protected override void Dispose(bool disposing)
        {
        }
    }
}
