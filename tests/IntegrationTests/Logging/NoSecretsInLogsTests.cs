using System.Net;
using System.Text;
using Application.Common.Interfaces.TranslationService;
using Application.MiniApp.Commands;
using Application.Translation;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Logging;
using Infrastructure.Telegram;
using Infrastructure.Translation.GoogleTranslation;
using Infrastructure.Translation.OpenAiTranslation;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Persistence;
using Telegram.Bot;
using Testcontainers.PostgreSql;

namespace IntegrationTests.Logging;

/// <summary>
/// No log record of the application — at any level, in message, structured values, scopes or exception
/// text — carries a configured secret. The application runs with the real Telegram client (its HTTP
/// goes to a stub), so the real HttpClient logging is exercised, and every level is captured.
/// </summary>
public class NoSecretsInLogsTests
{
    // Fake values, shaped like the real ones.
    private const string BotTokenSecretHalf = "AAFakeBotTokenForLogTests_0123456789";
    private const string BotToken = "7000000001:" + BotTokenSecretHalf;
    private const string WebhookToken = "Fake-Webhook-Token-5f2c9a71";
    private const string PaymentProviderToken = "fake-payment-provider-token-8841";
    private const string OpenAiKey = "sk-fake-openai-key-000111222333";
    private const string GooglePrivateKey = "-----BEGIN PRIVATE KEY-----\nFAKEFAKEFAKEFAKE0123456789\n-----END PRIVATE KEY-----\n";

    private static readonly string GoogleCredentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(
        System.Text.Json.JsonSerializer.Serialize(new { type = "service_account", private_key = GooglePrivateKey })));

    private static readonly string[] Secrets =
    [
        BotToken, BotTokenSecretHalf, WebhookToken, PaymentProviderToken, OpenAiKey, GoogleCredentials, GooglePrivateKey,
        "FAKEFAKEFAKEFAKE0123456789"
    ];

    private PostgreSqlContainer _postgres = null!;
    private TraleTestApplication _app = null!;
    private readonly LogCapture _log = new();
    private readonly TelegramApiStub _telegram = new();

    [OneTimeSetUp]
    public async Task StartApplication()
    {
        _postgres = new PostgreSqlBuilder().WithAutoRemove(true).WithImage("postgres:16.1").Build();
        await _postgres.StartAsync();

        _app = new TraleTestApplication(_postgres.GetConnectionString(), services =>
        {
            // Every level of every category, whatever appsettings say.
            services.AddLogging(logging =>
            {
                logging.SetMinimumLevel(LogLevel.Trace);
                logging.AddProvider(_log);
                logging.AddFilter<LogCapture>(null, LogLevel.Trace);
            });

            services.RemoveAll<BotConfiguration>();
            services.AddSingleton(new BotConfiguration
            {
                BotName = "traletestmock_bot",
                Token = BotToken,
                // With a host address the application registers its webhook on start — through the stub.
                HostAddress = "https://bot.example.test",
                WebhookToken = WebhookToken,
                PaymentProviderToken = PaymentProviderToken
            });
            services.AddSingleton(Options.Create(new OpenAiConfig { ApiKey = OpenAiKey }));
            services.AddSingleton(Options.Create(new GoogleApiConfig { ApiKeyBase64 = GoogleCredentials }));

            // The real Telegram client over the application's own named HttpClient; only the wire is a stub.
            services.RemoveAll<ITelegramBotClient>();
            services.AddHttpClient(TelegramHttpLogger.HttpClientName)
                .ConfigurePrimaryHttpMessageHandler(() => _telegram);
            services.AddTransient<ITelegramBotClient>(provider => new TelegramBotClient(
                new TelegramBotClientOptions(BotToken),
                provider.GetRequiredService<IHttpClientFactory>().CreateClient(TelegramHttpLogger.HttpClientName)));

            // Dictionary site and Google fail the way an HTTP client fails: with the request URL and
            // credentials in the exception text.
            services.RemoveAll<IParsingUniversalTranslator>();
            services.RemoveAll<IGoogleApiTranslator>();
            services.AddSingleton<IParsingUniversalTranslator, LeakyTranslator>();
            services.AddSingleton<IGoogleApiTranslator, LeakyTranslator>();
        });

        using var scope = _app.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<TraleDbContext>().Database.MigrateAsync();
    }

    [OneTimeTearDown]
    public async Task StopApplication()
    {
        await _app.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [SetUp]
    public void TelegramAnswers() => _telegram.Mode = TelegramApiStub.Answer.Ok;

    [Test]
    public void Application_logs_through_the_redacting_factory()
    {
        _app.Services.GetRequiredService<ILoggerFactory>().Should().BeOfType<RedactingLoggerFactory>();
    }

    [Test]
    public void Startup_registers_the_webhook_without_logging_a_token()
    {
        // The host is started by the fixture; CreateWebhook has already called Telegram.
        _telegram.Methods.Should().Contain("setWebhook");
        _log.Messages.Should().Contain(m => m.Contains("Telegram API setWebhook -> 200"));

        ShouldHoldNoSecrets();
    }

    [Test]
    public async Task Webhook_call_with_the_right_token_is_logged_with_the_token_masked()
    {
        using var client = _app.CreateClient();

        var response = await client.PostAsync($"/telegram/{WebhookToken}", Create.TelegramUpdate(updateId: 5001, userTelegramId: 5001).ToJsonContent());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        _telegram.Methods.Should().Contain("sendMessage", because: "/start is answered through the real client");
        _log.Messages.Should().Contain(m => m.Contains("Request starting") && m.Contains("/telegram/[redacted:webhook-token]"),
            because: "the request line stays in the log, without the token");
        _log.Messages.Should().Contain(m => m.Contains("Telegram API sendMessage -> 200 in "));

        ShouldHoldNoSecrets();
    }

    [TestCase("lower")]
    [TestCase("upper")]
    public async Task Webhook_call_with_the_token_in_another_case_is_refused_and_the_value_is_not_logged(string letterCase)
    {
        var almost = letterCase == "lower" ? WebhookToken.ToLowerInvariant() : WebhookToken.ToUpperInvariant();
        using var client = _app.CreateClient();
        var sentBefore = _telegram.Methods.Count;

        var response = await client.PostAsync($"/telegram/{almost}", Create.TelegramUpdate(updateId: 5002, userTelegramId: 5002).ToJsonContent());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        _telegram.Methods.Count.Should().Be(sentBefore, because: "an update under a wrong token is not processed");
        _log.Messages.Should().Contain(m => m.Contains($"Webhook call with a wrong token (length {WebhookToken.Length}, sha256 prefix "));

        ShouldHoldNoSecrets();
    }

    [Test]
    public async Task Webhook_call_with_a_wrong_token_logs_its_length_and_hash_only()
    {
        const string guess = "some-guess-of-a-webhook-token";
        using var client = _app.CreateClient();

        await client.PostAsync($"/telegram/{guess}", Create.TelegramUpdate(updateId: 5003, userTelegramId: 5003).ToJsonContent());

        _log.Messages.Where(m => m.Contains("] Trale.Controllers.TelegramController:")).Should()
            .NotContain(m => m.Contains(guess), because: "the controller does not echo what it was sent");
        ShouldHoldNoSecrets();
    }

    [Test]
    public async Task Outgoing_telegram_call_is_logged_by_method_status_and_duration()
    {
        var bot = _app.Services.GetRequiredService<ITelegramBotClient>();

        await bot.SendTextMessageAsync(42, "hello");

        _log.Messages.Should().Contain(m => m.Contains("Telegram API sendMessage -> 200 in "));
        _log.Messages.Should().NotContain(m => m.Contains("api.telegram.org"),
            because: "the Telegram client does not log request URLs at all — masked or not");
        ShouldHoldNoSecrets();
    }

    [Test]
    public async Task Telegram_refusing_a_call_does_not_put_the_token_into_the_log()
    {
        _telegram.Mode = TelegramApiStub.Answer.Unauthorized;
        var bot = _app.Services.GetRequiredService<ITelegramBotClient>();

        var call = () => bot.SendTextMessageAsync(42, "hello");

        await call.Should().ThrowAsync<Telegram.Bot.Exceptions.ApiRequestException>();
        _log.Messages.Should().Contain(m => m.Contains("[Warning]") && m.Contains("Telegram API sendMessage -> 401 in "));
        ShouldHoldNoSecrets();
    }

    [Test]
    public async Task Failed_telegram_call_inside_a_webhook_is_logged_without_the_url_from_the_exception()
    {
        // The transport fails with the request URL in the exception text; the dialog processor logs
        // that exception, fails to tell the user (same failure), and the request ends in the
        // exceptions middleware — three places that write the exception.
        _telegram.Mode = TelegramApiStub.Answer.ThrowWithUrl;
        using var client = _app.CreateClient();

        var response = await client.PostAsync($"/telegram/{WebhookToken}", Create.TelegramUpdate(updateId: 5004, userTelegramId: 5004).ToJsonContent());

        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        _log.Messages.Should().Contain(m => m.Contains("Telegram API sendMessage failed after "));
        _log.Messages.Should().Contain(m => m.Contains("Exception while processing request from user"));
        _log.Lines.Should().Contain(l => l.StartsWith("exception: ") && l.Contains("/bot[redacted:bot-token]/sendMessage"),
            because: "the exception stays readable, with the token masked");
        ShouldHoldNoSecrets();
    }

    [Test]
    public async Task Refund_call_goes_through_the_same_client_and_is_logged_the_same_way()
    {
        using var scope = _app.Services.CreateScope();
        var refunds = scope.ServiceProvider.GetRequiredService<ITelegramRefundClient>();

        (await refunds.RefundStarPaymentAsync(42, "charge-1", CancellationToken.None)).Should().BeTrue();
        _telegram.Mode = TelegramApiStub.Answer.ThrowWithUrl;
        (await refunds.RefundStarPaymentAsync(42, "charge-2", CancellationToken.None)).Should().BeFalse();

        _log.Messages.Should().Contain(m => m.Contains("Telegram API refundStarPayment -> 200 in "));
        _log.Messages.Should().Contain(m => m.Contains("Telegram refundStarPayment exception"));
        ShouldHoldNoSecrets();
    }

    [Test]
    public async Task Translation_that_fails_with_credentials_in_the_error_is_logged_without_them()
    {
        using var scope = _app.Services.CreateScope();
        var translator = scope.ServiceProvider.GetRequiredService<ILanguageTranslator>();

        var result = await translator.Translate("стол", Language.Georgian, CancellationToken.None);

        result.Should().BeOfType<TranslationResult.Failure>();
        _log.Messages.Should().Contain(m => m.Contains("in universal parser"));
        _log.Messages.Should().Contain(m => m.Contains("in google translate"));
        _log.Lines.Should().Contain(l => l.StartsWith("exception: ") && l.Contains("key=[redacted:openai-key]"));
        ShouldHoldNoSecrets();
    }

    private void ShouldHoldNoSecrets()
    {
        var lines = _log.Lines;
        lines.Should().NotBeEmpty();
        foreach (var secret in Secrets)
        {
            var leaks = lines.Where(l => l.Contains(secret, StringComparison.OrdinalIgnoreCase)).Take(3).ToList();
            leaks.Should().BeEmpty($"no log record may carry the secret that starts with '{secret[..6]}…'");
        }
    }

    /// <summary>api.telegram.org as the bot sees it.</summary>
    private sealed class TelegramApiStub : HttpMessageHandler
    {
        public enum Answer { Ok, Unauthorized, ThrowWithUrl }

        private readonly List<string> _methods = new();

        public Answer Mode { get; set; }

        /// <summary>The Bot API methods that were called, in order.</summary>
        public IReadOnlyList<string> Methods { get { lock (_methods) return _methods.ToArray(); } }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var method = request.RequestUri!.Segments[^1];
            lock (_methods) _methods.Add(method);

            switch (Mode)
            {
                case Answer.ThrowWithUrl:
                    throw new HttpRequestException($"Connection refused ({request.RequestUri})");
                case Answer.Unauthorized:
                    return Task.FromResult(Json(HttpStatusCode.Unauthorized, """{"ok":false,"error_code":401,"description":"Unauthorized"}"""));
                default:
                    var result = method.StartsWith("send", StringComparison.Ordinal)
                        ? """{"message_id":1,"date":1700000000,"chat":{"id":42,"type":"private"}}"""
                        : "true";
                    return Task.FromResult(Json(HttpStatusCode.OK, $$"""{"ok":true,"result":{{result}}}"""));
            }
        }

        private static HttpResponseMessage Json(HttpStatusCode status, string body) =>
            new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

        // The HttpClient factory disposes its handlers; this one lives as long as the fixture.
        protected override void Dispose(bool disposing)
        {
        }
    }

    /// <summary>An external translator whose error text carries the request URL with a key, and the other credentials.</summary>
    private sealed class LeakyTranslator : IParsingUniversalTranslator, IGoogleApiTranslator
    {
        public Task<TranslationResult> TranslateAsync(string requestWord, Language targetLanguage, CancellationToken ct) =>
            throw new HttpRequestException(
                $"GET https://translation.example.test/v2?key={OpenAiKey}&q={requestWord} failed",
                new InvalidOperationException($"credentials {GoogleCredentials} / {GooglePrivateKey} / {PaymentProviderToken} rejected"));
    }
}
