using System.Text;
using Infrastructure.Logging;
using Infrastructure.Telegram;
using Infrastructure.Translation.GoogleTranslation;
using Infrastructure.Translation.OpenAiTranslation;
using Microsoft.Extensions.Logging;
using Shouldly;

namespace Infrastructure.UnitTests.Logging;

public class SecretRedactionTests
{
    private const string BotToken = "7000000001:AAFakeBotTokenForUnitTests_012345";
    private const string WebhookToken = "fake-webhook-token-77aa";
    private const string DbPassword = "fake-db-pass+word/1";

    private static BotConfiguration Bot(string token = BotToken, string webhookToken = WebhookToken, string paymentToken = "") => new()
    {
        BotName = "bot", HostAddress = "", Token = token, WebhookToken = webhookToken, PaymentProviderToken = paymentToken
    };

    private static SecretRedactor Redactor(params string?[] connectionStrings) =>
        new(LogSecrets.Collect(Bot(), new OpenAiConfig { ApiKey = "sk-fake-openai-key-42" }, null, connectionStrings));

    [Test]
    public void Clean_text_comes_back_as_the_same_instance()
    {
        const string text = "Request finished HTTP/1.1 GET http://localhost/healthz - 200";

        Redactor().Redact(text).ShouldBeSameAs(text);
    }

    [Test]
    public void Secrets_are_replaced_by_named_masks_and_the_rest_of_the_line_stays()
    {
        var redactor = Redactor($"Host=db;Username=trale;Password={DbPassword};Database=trale");

        redactor.Redact($"POST https://api.telegram.org/bot{BotToken}/sendMessage")
            .ShouldBe("POST https://api.telegram.org/bot[redacted:bot-token]/sendMessage");
        redactor.Redact($"Request starting HTTP/1.1 POST http://host/telegram/{WebhookToken.ToUpperInvariant()} - 12")
            .ShouldBe("Request starting HTTP/1.1 POST http://host/telegram/[redacted:webhook-token] - 12");
        redactor.Redact("Authorization: Bearer sk-fake-openai-key-42").ShouldBe("Authorization: Bearer [redacted:openai-key]");
        redactor.Redact($"Password={DbPassword}").ShouldBe("Password=[redacted:db-password]");
        redactor.Redact($"?p={Uri.EscapeDataString(DbPassword)}").ShouldBe("?p=[redacted:db-password]");
    }

    [Test]
    public void The_secret_half_of_the_bot_token_is_masked_on_its_own()
    {
        Redactor().Redact("token ends with AAFakeBotTokenForUnitTests_012345").ShouldBe("token ends with [redacted:bot-token]");
    }

    [TestCase("")]
    [TestCase("   ")]
    [TestCase("abc")]
    public void Empty_and_very_short_values_are_not_treated_as_secrets(string value)
    {
        var secrets = LogSecrets.Collect(Bot(token: value, webhookToken: value, paymentToken: value), null, null, [value, "not a connection string"]);

        secrets.ShouldBeEmpty();
    }

    [Test]
    public void Values_are_trimmed_the_way_the_application_trims_them()
    {
        var secrets = LogSecrets.Collect(Bot(webhookToken: $" {WebhookToken}\n"), null, null, []);

        secrets.ShouldContain(new LogSecret(WebhookToken, "webhook-token"));
    }

    [Test]
    public void Google_credentials_are_masked_both_as_configured_and_as_the_private_key_inside()
    {
        const string privateKey = "-----BEGIN PRIVATE KEY-----\nFAKEKEYFAKEKEY\n-----END PRIVATE KEY-----\n";
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(
            System.Text.Json.JsonSerializer.Serialize(new { type = "service_account", private_key = privateKey })));
        var redactor = new SecretRedactor(LogSecrets.Collect(null, null, new GoogleApiConfig { ApiKeyBase64 = credentials }, []));

        redactor.Redact($"credentials {credentials}").ShouldBe("credentials [redacted:google-credentials]");
        redactor.Redact($"key {privateKey}").ShouldBe("key [redacted:google-private-key]\n");
    }

    [Test]
    public void Structured_values_keep_their_type_unless_they_carry_a_secret()
    {
        var redactor = Redactor();
        var clean = new Uri("https://glosbe.com/ka/ru/word");
        object number = 42;

        redactor.RedactValue(clean).ShouldBeSameAs(clean);
        redactor.RedactValue(number).ShouldBeSameAs(number);
        redactor.RedactValue(new Uri($"https://api.telegram.org/bot{BotToken}/getMe"))
            .ShouldBe("https://api.telegram.org/bot[redacted:bot-token]/getMe");
        redactor.RedactValue(new[] { "a", WebhookToken }).ShouldBe("a, [redacted:webhook-token]");
    }

    [Test]
    public void An_exception_with_a_secret_in_its_text_is_replaced_by_its_masked_text()
    {
        var redactor = Redactor();
        var clean = new InvalidOperationException("nothing secret");
        var leaking = new InvalidOperationException("outer", new HttpRequestException($"GET https://api.telegram.org/bot{BotToken}/getMe failed"));

        redactor.RedactException(clean).ShouldBeSameAs(clean);
        var redacted = redactor.RedactException(leaking);
        redacted.ToString().ShouldContain("System.Net.Http.HttpRequestException: GET https://api.telegram.org/bot[redacted:bot-token]/getMe failed");
        redacted.ToString().ShouldNotContain(BotToken);
        redacted.InnerException.ShouldBeNull();
    }

    [Test]
    public void Every_provider_gets_masked_message_values_scopes_and_exception()
    {
        var sink = new Sink();
        using var factory = new RedactingLoggerFactory(
            LoggerFactory.Create(logging => logging.SetMinimumLevel(LogLevel.Trace).AddProvider(sink)), Redactor());
        var logger = factory.CreateLogger("test");

        using (logger.BeginScope(new Dictionary<string, object?> { ["RequestPath"] = $"/telegram/{WebhookToken}" }))
        using (logger.BeginScope("plain scope {Token}", WebhookToken))
        {
            logger.LogError(new Exception($"boom {BotToken}"), "Calling {Url} for {User}", new Uri($"https://api.telegram.org/bot{BotToken}/getMe"), 42);
        }

        var all = string.Join("\n", sink.Seen);
        all.ShouldNotContain(BotToken);
        all.ShouldNotContain(WebhookToken);
        sink.Seen.ShouldContain("message: Calling https://api.telegram.org/bot[redacted:bot-token]/getMe for 42");
        sink.Seen.ShouldContain("value: Url=https://api.telegram.org/bot[redacted:bot-token]/getMe");
        sink.Seen.ShouldContain("value: User=42");
        sink.Seen.ShouldContain("value: {OriginalFormat}=Calling {Url} for {User}");
        sink.Seen.ShouldContain("scope: RequestPath=/telegram/[redacted:webhook-token]");
        sink.Seen.ShouldContain("scope: plain scope [redacted:webhook-token]");
        sink.Seen.ShouldContain("exception: System.Exception: boom [redacted:bot-token]");
    }

    [TestCase("https://api.telegram.org/bot7000000001:AAFake/sendMessage", "sendMessage")]
    [TestCase("https://api.telegram.org/file/bot7000000001:AAFake/photos/file_1.jpg", "photos/file_1.jpg")]
    [TestCase("https://api.telegram.org/bot7000000001:AAFake", "(unknown)")]
    [TestCase("https://api.telegram.org/bot7000000001:AAFake/", "(unknown)")]
    [TestCase("https://example.test/7000000001:AAFake", "(unknown)")]
    public void Telegram_call_is_named_by_what_follows_the_token_never_by_the_token(string url, string expected)
    {
        TelegramHttpLogger.ApiMethodOf(new Uri(url)).ShouldBe(expected);
    }

    private sealed class Sink : ILoggerProvider, ILogger
    {
        private readonly List<object> _scopes = new();
        public List<string> Seen { get; } = new();

        public ILogger CreateLogger(string categoryName) => this;

        public void Dispose()
        {
        }

        public IDisposable BeginScope<TState>(TState state) where TState : notnull
        {
            _scopes.Add(state);
            return this;
        }

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            Seen.Add($"message: {formatter(state, exception)}");
            Seen.Add($"state: {state}");
            foreach (var pair in (IEnumerable<KeyValuePair<string, object?>>)state!)
            {
                Seen.Add($"value: {pair.Key}={pair.Value}");
            }

            foreach (var scope in _scopes)
            {
                Seen.Add($"scope: {scope}");
                if (scope is IEnumerable<KeyValuePair<string, object?>> pairs)
                {
                    Seen.AddRange(pairs.Select(p => $"scope: {p.Key}={p.Value}"));
                }
            }

            Seen.Add($"exception: {exception}");
        }
    }
}
