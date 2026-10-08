using System.Data.Common;
using System.Text;
using System.Text.Json;
using Infrastructure.Telegram;
using Infrastructure.Translation.GoogleTranslation;
using Infrastructure.Translation.OpenAiTranslation;

namespace Infrastructure.Logging;

/// <summary>A configured value that must never reach a log, and the name its mask carries.</summary>
public readonly record struct LogSecret(string Value, string Name);

/// <summary>
/// The list of configured secrets the log pipeline masks. A new secret in configuration is added here —
/// this is the one place that knows them all.
/// </summary>
public static class LogSecrets
{
    /// <summary>
    /// Shorter values are not masked: a three-letter "secret" would blank out half of every log line.
    /// A real token is far longer than this.
    /// </summary>
    public const int MinLength = 6;

    public static IReadOnlyList<LogSecret> Collect(
        BotConfiguration? bot,
        OpenAiConfig? openAi,
        GoogleApiConfig? google,
        IEnumerable<string?> connectionStrings)
    {
        var secrets = new List<LogSecret>();

        Add(secrets, bot?.Token, "bot-token");
        // The part after "<bot id>:" is the secret half; masked on its own in case the token is ever cut or re-encoded.
        Add(secrets, AfterColon(bot?.Token), "bot-token");
        Add(secrets, bot?.WebhookToken, "webhook-token");
        Add(secrets, bot?.PaymentProviderToken, "payment-provider-token");
        Add(secrets, openAi?.ApiKey, "openai-key");
        Add(secrets, google?.ApiKeyBase64, "google-credentials");
        Add(secrets, GooglePrivateKey(google?.ApiKeyBase64), "google-private-key");
        foreach (var connectionString in connectionStrings)
        {
            Add(secrets, PasswordOf(connectionString), "db-password");
        }

        // Longest first: a secret that contains another one is masked whole, under its own name.
        return secrets
            .DistinctBy(s => s.Value, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(s => s.Value.Length)
            .ToList();
    }

    private static void Add(List<LogSecret> secrets, string? value, string name)
    {
        value = value?.Trim();
        if (value == null || value.Length < MinLength)
        {
            return;
        }

        secrets.Add(new LogSecret(value, name));

        // The same value as it looks inside a URL, when that differs.
        var escaped = Uri.EscapeDataString(value);
        if (!string.Equals(escaped, value, StringComparison.Ordinal))
        {
            secrets.Add(new LogSecret(escaped, name));
        }
    }

    private static string? AfterColon(string? token)
    {
        var colon = token?.IndexOf(':') ?? -1;
        return colon < 0 ? null : token![(colon + 1)..];
    }

    private static string? PasswordOf(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        try
        {
            var builder = new DbConnectionStringBuilder { ConnectionString = connectionString };
            foreach (var key in new[] { "Password", "Pwd" })
            {
                if (builder.TryGetValue(key, out var value))
                {
                    return value?.ToString();
                }
            }
        }
        catch (ArgumentException)
        {
            // Not a key=value connection string: nothing to take a password from.
        }

        return null;
    }

    /// <summary>The Google credentials are a base64 of a service-account JSON; its private key is the secret inside.</summary>
    private static string? GooglePrivateKey(string? credentialsBase64)
    {
        if (string.IsNullOrWhiteSpace(credentialsBase64))
        {
            return null;
        }

        try
        {
            using var json = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(credentialsBase64.Trim())));
            return json.RootElement.ValueKind == JsonValueKind.Object
                   && json.RootElement.TryGetProperty("private_key", out var key)
                   && key.ValueKind == JsonValueKind.String
                ? key.GetString()
                : null;
        }
        catch (Exception e) when (e is FormatException or JsonException)
        {
            return null;
        }
    }
}
