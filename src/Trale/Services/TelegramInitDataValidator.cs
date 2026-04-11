using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Web;

namespace Trale.Services;

/// <summary>
/// Validates Telegram WebApp initData per
/// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
/// Returns the authenticated Telegram user id or null.
/// </summary>
public static class TelegramInitDataValidator
{
    private static readonly TimeSpan DefaultMaxAge = TimeSpan.FromHours(24);

    public static long? ValidateAndGetUserId(string initData, string botToken, TimeSpan? maxAge = null)
    {
        if (string.IsNullOrWhiteSpace(initData) || string.IsNullOrWhiteSpace(botToken))
        {
            return null;
        }

        var parsed = HttpUtility.ParseQueryString(initData);
        var hash = parsed["hash"];
        if (string.IsNullOrEmpty(hash))
        {
            return null;
        }

        var dataCheckString = string.Join(
            '\n',
            parsed.AllKeys
                .Where(k => k != null && k != "hash")
                .OrderBy(k => k, StringComparer.Ordinal)
                .Select(k => $"{k}={parsed[k]}"));

        using var secretKeyHmac = new HMACSHA256(Encoding.UTF8.GetBytes("WebAppData"));
        var secretKey = secretKeyHmac.ComputeHash(Encoding.UTF8.GetBytes(botToken));

        using var dataHmac = new HMACSHA256(secretKey);
        var computedHash = dataHmac.ComputeHash(Encoding.UTF8.GetBytes(dataCheckString));
        var computedHex = Convert.ToHexString(computedHash).ToLowerInvariant();

        if (!string.Equals(computedHex, hash.ToLowerInvariant(), StringComparison.Ordinal))
        {
            return null;
        }

        if (!long.TryParse(parsed["auth_date"], out var authDateUnix))
        {
            return null;
        }
        var authDate = DateTimeOffset.FromUnixTimeSeconds(authDateUnix);
        if (DateTimeOffset.UtcNow - authDate > (maxAge ?? DefaultMaxAge))
        {
            return null;
        }

        var userJson = parsed["user"];
        if (string.IsNullOrEmpty(userJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(userJson);
            if (doc.RootElement.TryGetProperty("id", out var idProp) && idProp.TryGetInt64(out var id))
            {
                return id;
            }
        }
        catch (JsonException)
        {
        }

        return null;
    }
}
