using System.Security.Cryptography;
using System.Text;

namespace IntegrationTests.DSL;

/// <summary>
/// Generates a correctly-signed Telegram WebApp initData string for integration tests
/// that call auth-protected /api/miniapp/* endpoints.
/// </summary>
public static class MiniAppInitDataHelper
{
    public static string CreateValidInitData(long telegramId, string botToken)
    {
        var authDateUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var userJson = $"{{\"id\":{telegramId},\"first_name\":\"Test\",\"is_bot\":false}}";

        // Data-check string = sorted (alphabetical by key, excl. hash) key=value pairs, joined by \n
        // Keys here: auth_date, user — already alphabetical
        var dataCheckString = $"auth_date={authDateUnix}\nuser={userJson}";

        using var secretKeyHmac = new HMACSHA256(Encoding.UTF8.GetBytes("WebAppData"));
        var secretKey = secretKeyHmac.ComputeHash(Encoding.UTF8.GetBytes(botToken));
        using var dataHmac = new HMACSHA256(secretKey);
        var hash = Convert.ToHexString(dataHmac.ComputeHash(Encoding.UTF8.GetBytes(dataCheckString)))
            .ToLowerInvariant();

        // URL-encode the user JSON so the query string parses correctly
        var encodedUser = Uri.EscapeDataString(userJson);
        return $"auth_date={authDateUnix}&user={encodedUser}&hash={hash}";
    }
}
