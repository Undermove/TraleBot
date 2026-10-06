using System.Security.Cryptography;
using System.Text;
using Infrastructure.Telegram;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Persistence;

namespace IntegrationTests.DSL;

/// <summary>
/// The test application with a bot token, so mini-app and admin endpoints can be called over HTTP
/// the way the mini-app calls them: with initData signed by that token. Background workers are
/// switched off in this copy — a test decides itself when referrals are processed or a campaign is sent.
/// </summary>
public static class SignedMiniApp
{
    private const string Token = "integration-test-token";
    public const string Host = "https://test.tralebot.example";

    public static TraleTestApplication WithSignedLogin(this TraleTestApplication app, long ownerTelegramId)
    {
        using var scope = app.Services.CreateScope();
        var connectionString = scope.ServiceProvider.GetRequiredService<TraleDbContext>().Database.GetConnectionString()!;
        return new TraleTestApplication(connectionString, services =>
        {
            services.RemoveAll(typeof(BotConfiguration));
            services.AddSingleton(new BotConfiguration
            {
                Token = Token,
                HostAddress = Host,
                WebhookToken = "test_token",
                PaymentProviderToken = null!,
                BotName = "traletestmock_bot",
                MiniAppEnabled = true,
                OwnerTelegramId = ownerTelegramId
            });

            foreach (var worker in services
                         .Where(d => d.ServiceType == typeof(IHostedService)
                                     && d.ImplementationType?.Namespace?.StartsWith("Trale") == true)
                         .ToList())
            {
                services.Remove(worker);
            }
        });
    }

    /// <summary>HTTP client that signs in as the given Telegram user.</summary>
    public static HttpClient ClientFor(this TraleTestApplication app, long telegramId)
    {
        var client = app.CreateClient();
        client.DefaultRequestHeaders.Add("X-Telegram-Init-Data", InitData(telegramId));
        return client;
    }

    private static string InitData(long telegramId)
    {
        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["auth_date"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
            ["query_id"] = "integration",
            ["user"] = $"{{\"id\":{telegramId},\"first_name\":\"Test\"}}"
        };
        var check = string.Join('\n', fields.Select(f => $"{f.Key}={f.Value}"));
        var secret = HMACSHA256.HashData(Encoding.UTF8.GetBytes("WebAppData"), Encoding.UTF8.GetBytes(Token));
        var hash = Convert.ToHexString(HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(check))).ToLowerInvariant();
        return string.Join('&', fields.Select(f => $"{f.Key}={Uri.EscapeDataString(f.Value)}")) + $"&hash={hash}";
    }
}
