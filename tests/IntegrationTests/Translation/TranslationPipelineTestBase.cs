using System.Text.Json.Nodes;
using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation;
using Application.Translation.Pipeline;
using Application.Verbs;
using Domain.Entities;
using Infrastructure.Translation.Agent;
using Infrastructure.Translation.Wiktionary;
using IntegrationTests.Fakes;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Persistence;
using Telegram.Bot;
using Testcontainers.PostgreSql;

namespace IntegrationTests.Translation;

/// <summary>
/// The application as in <see cref="TestBase"/> (real Postgres, real DI graph, real Microsoft Agent
/// Framework agents), with the three things that would leave the process replaced: the models
/// (<see cref="FakeChatClient"/>), Wiktionary (<see cref="FakeWiktionaryHandler"/>) and the old external
/// translators (<see cref="FakeExternalTranslator"/>). Nothing here can reach a model or the network.
/// </summary>
public abstract class TranslationPipelineTestBase
{
    private PostgreSqlContainer _postgres = null!;
    protected WebApplicationFactory<Program> App = null!;

    protected FakeTranslationChatClients Models { get; } = new();
    protected FakeExternalTranslator External { get; } = new();
    protected FakeWiktionaryHandler Wiktionary { get; } = new();
    protected PipelineLog Log { get; } = new();
    protected FakeLexicon Lexicon { get; } = new();
    protected TelegramClientFake Telegram => (TelegramClientFake)App.Services.GetRequiredService<ITelegramBotClient>();

    [OneTimeSetUp]
    public async Task StartApplication()
    {
        _postgres = new PostgreSqlBuilder().WithAutoRemove(true).WithImage("postgres:16.1").Build();
        await _postgres.StartAsync();

        App = new TraleTestApplication(_postgres.GetConnectionString()).WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<Microsoft.Extensions.Logging.ILoggerProvider>(Log);

                services.RemoveAll<IVerbLexicon>();
                services.AddSingleton<IVerbLexicon>(Lexicon);

                services.RemoveAll<ITranslationChatClients>();
                services.AddSingleton<ITranslationChatClients>(Models);

                services.RemoveAll<IParsingUniversalTranslator>();
                services.RemoveAll<IGoogleApiTranslator>();
                services.AddSingleton<IParsingUniversalTranslator>(External);
                services.AddSingleton<IGoogleApiTranslator>(External);

                // The English module's OpenAI service cannot even be constructed without a key
                // (it creates its client in the constructor), and resolving ILanguageTranslator builds every module.
                services.RemoveAll<IAiTranslationService>();
                services.AddSingleton<IAiTranslationService, NoAiTranslationService>();

                services.AddHttpClient(WiktionaryVerbSource.HttpClientName)
                    .ConfigurePrimaryHttpMessageHandler(() => new NonDisposing(Wiktionary));

                services.Configure<TranslationAgentOptions>(options =>
                {
                    options.Enabled = true;
                    options.ClassifierTimeoutSeconds = 1;
                    options.AnalystTimeoutSeconds = 1;
                    options.WiktionaryMinIntervalMs = 0;
                    options.WiktionaryRetryDelayMs = 0;
                });
            }));

        using var scope = App.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<TraleDbContext>().Database.MigrateAsync();
    }

    [OneTimeTearDown]
    public async Task StopApplication()
    {
        await App.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [SetUp]
    public void ResetFakes()
    {
        Models.Configured = true;
        Models.ClassifierModel.Reset();
        Models.AnalystModel.Reset();
        Models.GeneratorModel.Reset();
        Models.ReviewerModel.Reset();
        Models.CanGenerate = true;
        External.Reset();
        Wiktionary.Reset();
        Log.Reset();
        Lexicon.Reset();
    }

    // ── The curated catalog: the only place Georgian in these tests comes from ───────────────────

    protected static JsonArray Catalog() =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json")))!["verbs"]!.AsArray();

    protected static JsonObject CatalogVerb(string lemma) =>
        Catalog().Select(v => v!.AsObject()).Single(v => v["lemma"]!.GetValue<string>() == lemma);

    protected static string Form(JsonObject verb, string tense, int person) =>
        verb["tenses"]![tense]![person]![0]!.GetValue<string>();

    /// <summary>Empties the verb base and the cache and loads the catalog, optionally without some verbs.</summary>
    protected async Task SeedCatalogWithout(params string[] lemmas)
    {
        var verbs = new JsonArray(Catalog()
            .Where(v => !lemmas.Contains(v!["lemma"]!.GetValue<string>()))
            .Select(v => v!.DeepClone())
            .ToArray());

        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.ToListAsync());
            db.TranslationCache.RemoveRange(await db.TranslationCache.ToListAsync());
            await db.SaveChangesAsync(CancellationToken.None);
            await sp.GetRequiredService<VerbCatalogSeeder>()
                .SeedAsync(new JsonObject { ["verbs"] = verbs }.ToJsonString(), CancellationToken.None);
            return 0;
        });
    }

    // ── Running the code under test ──────────────────────────────────────────────────────────────

    protected async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        using var scope = App.Services.CreateScope();
        return await action(scope.ServiceProvider);
    }

    /// <summary>One translation request, in its own DI scope like a real one.</summary>
    protected Task<TranslationResult> Translate(string text) =>
        InScope(sp => sp.GetRequiredService<ILanguageTranslator>().Translate(text, Language.Georgian, CancellationToken.None));

    protected Task<Verb?> StoredVerb(string lemma) =>
        InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs.AsNoTracking().FirstOrDefaultAsync(v => v.Lemma == lemma));

    protected Task<List<TranslationCacheEntry>> CacheEntries() =>
        InScope(sp => sp.GetRequiredService<ITraleDbContext>().TranslationCache.AsNoTracking().ToListAsync());

    private sealed class NoAiTranslationService : IAiTranslationService
    {
        public Task<TranslationResult> TranslateAsync(string? requestWord, Language language, CancellationToken ct) =>
            throw new InvalidOperationException("The English AI translator must not be called by these tests");
    }

    /// <summary>The factory disposes handlers it rotates out; the fake has to outlive that.</summary>
    private sealed class NonDisposing(HttpMessageHandler inner) : DelegatingHandler(inner)
    {
        protected override void Dispose(bool disposing)
        {
        }
    }
}
