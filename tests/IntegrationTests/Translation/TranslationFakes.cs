using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Infrastructure.Translation.Agent;
using Microsoft.Extensions.AI;

namespace IntegrationTests.Translation;

/// <summary>
/// A model that answers from a script. Each request is handed to <see cref="Respond"/> together with
/// the whole conversation so far, so a script can react to tool results the way a model would.
/// </summary>
public class FakeChatClient : IChatClient
{
    public int Calls { get; private set; }

    /// <summary>The conversations the "model" was shown, one entry per request.</summary>
    public List<IReadOnlyList<ChatMessage>> Conversations { get; } = new();

    public Func<IReadOnlyList<ChatMessage>, CancellationToken, Task<ChatMessage>> Respond { get; set; } =
        (_, _) => throw new InvalidOperationException("The test did not expect a model call");

    public void Reset()
    {
        Calls = 0;
        Conversations.Clear();
        Respond = (_, _) => throw new InvalidOperationException("The test did not expect a model call");
    }

    /// <summary>The model answers every request with this JSON.</summary>
    public void AnswerWith(string json) => Respond = (_, _) => Task.FromResult(new ChatMessage(ChatRole.Assistant, json));

    /// <summary>
    /// The model first calls the given tools one by one, reading each result, and then answers with the
    /// JSON built from all tool results.
    /// </summary>
    public void CallToolsThenAnswer(
        IReadOnlyList<(string Tool, Dictionary<string, object?> Arguments)> toolCalls,
        Func<IReadOnlyList<string>, string> answer)
    {
        Respond = (messages, _) =>
        {
            var results = ToolResults(messages);
            if (results.Count < toolCalls.Count)
            {
                var (tool, arguments) = toolCalls[results.Count];
                return Task.FromResult(new ChatMessage(ChatRole.Assistant,
                    [new FunctionCallContent($"call-{results.Count}", tool, arguments)]));
            }

            return Task.FromResult(new ChatMessage(ChatRole.Assistant, answer(results)));
        };
    }

    /// <summary>What the tools returned so far, serialised, in call order.</summary>
    public static IReadOnlyList<string> ToolResults(IEnumerable<ChatMessage> messages) =>
        messages.SelectMany(m => m.Contents).OfType<FunctionResultContent>().Select(r => r.Result?.ToString() ?? "").ToList();

    public async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        Calls++;
        var conversation = messages.ToList();
        Conversations.Add(conversation);
        return new ChatResponse(await Respond(conversation, cancellationToken));
    }

    public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default) =>
        throw new NotSupportedException();

    public object? GetService(Type serviceType, object? serviceKey = null) => null;

    public void Dispose()
    {
    }
}

/// <summary><see cref="Configured"/> = false is "no key / no model ids": the agent path must switch itself off.</summary>
public class FakeTranslationChatClients : ITranslationChatClients
{
    public bool Configured { get; set; } = true;
    public FakeChatClient ClassifierModel { get; } = new();
    public FakeChatClient AnalystModel { get; } = new();
    public FakeChatClient GeneratorModel { get; } = new();
    public FakeChatClient ReviewerModel { get; } = new();

    /// <summary>False = the generator and reviewer roles are not configured: verbs with no table are just translated.</summary>
    public bool CanGenerate { get; set; } = true;

    public IChatClient? Classifier => Configured ? ClassifierModel : null;
    public IChatClient? Analyst => Configured ? AnalystModel : null;
    public IChatClient? Generator => Configured && CanGenerate ? GeneratorModel : null;
    public IChatClient? Reviewer => Configured && CanGenerate ? ReviewerModel : null;

    public int ModelCalls => ClassifierModel.Calls + AnalystModel.Calls + GeneratorModel.Calls + ReviewerModel.Calls;
}

/// <summary>Stands in for the dictionary site and Google: the translator that was there before the pipeline.</summary>
public class FakeExternalTranslator : IParsingUniversalTranslator, IGoogleApiTranslator
{
    public const string Definition = "перевод с внешнего сайта";
    public const string GoogleDefinition = "перевод гугла";

    public int Calls { get; private set; }

    /// <summary>Neither the dictionary site nor Google has an answer.</summary>
    public bool Fails { get; set; }

    /// <summary>Texts the dictionary site has no entry for — Google is asked next, as in the old translator.</summary>
    public HashSet<string> DictionaryMisses { get; } = new();

    /// <summary>Who was asked about what, in order: "dictionary:стол", "google:стол".</summary>
    public List<string> Trail { get; } = new();

    public void Reset()
    {
        Calls = 0;
        Fails = false;
        DictionaryMisses.Clear();
        Trail.Clear();
    }

    Task<TranslationResult> IParsingUniversalTranslator.TranslateAsync(string requestWord, Language targetLanguage, CancellationToken ct)
    {
        Calls++;
        Trail.Add($"dictionary:{requestWord}");
        return Task.FromResult<TranslationResult>(Fails || DictionaryMisses.Contains(requestWord)
            ? new TranslationResult.Failure()
            : new TranslationResult.Success(Definition, "", ""));
    }

    Task<TranslationResult> IGoogleApiTranslator.TranslateAsync(string requestWord, Language targetLanguage, CancellationToken ct)
    {
        Calls++;
        Trail.Add($"google:{requestWord}");
        return Task.FromResult<TranslationResult>(Fails
            ? new TranslationResult.Failure()
            : new TranslationResult.Success(GoogleDefinition, "", ""));
    }
}

/// <summary>Wiktionary without the network: recorded API responses by page title; any other page does not exist.</summary>
public class FakeWiktionaryHandler : HttpMessageHandler
{
    private static readonly string Missing = Fixture("wiktionary-missing.json");

    public Dictionary<string, string> Pages { get; } = new();
    public List<string> RequestedPages { get; } = new();

    /// <summary>How many of the next requests are answered 429 before the real answer.</summary>
    public int ThrottleNext { get; set; }

    public static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Translation", "Fixtures", name));

    /// <summary>Title of the page a recorded response is for.</summary>
    public static string TitleOf(string fixtureJson) => JsonNode.Parse(fixtureJson)!["parse"]!["title"]!.GetValue<string>();

    public void Reset()
    {
        Pages.Clear();
        RequestedPages.Clear();
        ThrottleNext = 0;
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var query = System.Web.HttpUtility.ParseQueryString(request.RequestUri!.Query);
        var page = query["page"] ?? string.Empty;
        RequestedPages.Add(page);
        if (request.RequestUri.Host != "en.wiktionary.org" || !request.Headers.UserAgent.ToString().Contains("TraleBot"))
        {
            throw new InvalidOperationException($"Unexpected request: {request.RequestUri}");
        }

        if (ThrottleNext > 0)
        {
            ThrottleNext--;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.TooManyRequests));
        }

        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(Pages.GetValueOrDefault(page, Missing), Encoding.UTF8, "application/json")
        });
    }
}

/// <summary>Collects the pipeline's "one line per request" log entries, so tests can see which path a request took.</summary>
public class PipelineLog : Microsoft.Extensions.Logging.ILoggerProvider
{
    private readonly List<string> _lines = new();

    public IReadOnlyList<string> Lines
    {
        get { lock (_lines) return _lines.ToList(); }
    }

    /// <summary>The "path a>b>c" part of every request line, oldest first.</summary>
    public IReadOnlyList<string> Paths => Lines
        .Select(l => System.Text.RegularExpressions.Regex.Match(l, "path ([^,]*),"))
        .Where(m => m.Success)
        .Select(m => m.Groups[1].Value)
        .ToList();

    public void Reset()
    {
        lock (_lines) _lines.Clear();
    }

    public Microsoft.Extensions.Logging.ILogger CreateLogger(string categoryName) =>
        categoryName.EndsWith("GeorgianTranslationPipeline") ? new Logger(this) : Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance;

    public void Dispose()
    {
    }

    private sealed class Logger(PipelineLog owner) : Microsoft.Extensions.Logging.ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) => true;

        public void Log<TState>(
            Microsoft.Extensions.Logging.LogLevel logLevel,
            Microsoft.Extensions.Logging.EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            lock (owner._lines) owner._lines.Add(formatter(state, exception));
        }
    }
}

/// <summary>The open lexicon and the attested forms, set by each test instead of the shipped data files.</summary>
public class FakeLexicon : Application.Verbs.IVerbLexicon
{
    public List<Application.Verbs.LexiconVerb> Verbs { get; } = new();

    /// <summary>Null = "the corpus data is not loaded": attestation checks are off.</summary>
    public HashSet<string>? Attested { get; set; }

    public void Reset()
    {
        Verbs.Clear();
        Attested = null;
    }

    public IReadOnlyList<Application.Verbs.LexiconVerb> Find(string lemmaOrMasdar) =>
        Verbs.Where(v => v.Lemma == lemmaOrMasdar || v.Masdar == lemmaOrMasdar).ToList();

    public IReadOnlyList<Application.Verbs.LexiconVerb> FindByRussian(string infinitive) =>
        Verbs.Where(v => v.Russian.Contains(infinitive)).ToList();

    public bool IsAttested(string form) => Attested?.Contains(form) ?? false;

    public bool HasAttestedForms => Attested != null;
}
