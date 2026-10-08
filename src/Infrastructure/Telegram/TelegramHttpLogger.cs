using Microsoft.Extensions.Http.Logging;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Telegram;

/// <summary>
/// Logs calls to the Telegram Bot API without the request URL: the URL is
/// <c>https://api.telegram.org/bot&lt;token&gt;/&lt;method&gt;</c>, and the default HttpClient loggers
/// print it whole. Only the API method, the status and the duration are written.
/// </summary>
public sealed class TelegramHttpLogger(ILogger<TelegramHttpLogger> logger) : IHttpClientLogger
{
    /// <summary>The named HttpClient every call to the Bot API goes through.</summary>
    public const string HttpClientName = "telegram_bot_client";

    public object? LogRequestStart(HttpRequestMessage request) => null;

    public void LogRequestStop(object? context, HttpRequestMessage request, HttpResponseMessage response, TimeSpan elapsed)
    {
        logger.Log(
            response.IsSuccessStatusCode ? LogLevel.Information : LogLevel.Warning,
            "Telegram API {ApiMethod} -> {StatusCode} in {ElapsedMs} ms",
            ApiMethodOf(request.RequestUri), (int)response.StatusCode, (long)elapsed.TotalMilliseconds);
    }

    public void LogRequestFailed(object? context, HttpRequestMessage request, HttpResponseMessage? response,
        Exception exception, TimeSpan elapsed)
    {
        logger.LogWarning(exception, "Telegram API {ApiMethod} failed after {ElapsedMs} ms",
            ApiMethodOf(request.RequestUri), (long)elapsed.TotalMilliseconds);
    }

    /// <summary>
    /// What follows the <c>bot&lt;token&gt;</c> segment: <c>sendMessage</c>, or a file path for downloads.
    /// Never the token segment itself, whatever the URL looks like.
    /// </summary>
    public static string ApiMethodOf(Uri? uri)
    {
        if (uri is not { IsAbsoluteUri: true })
        {
            return "(unknown)";
        }

        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var token = Array.FindIndex(segments, s => s.StartsWith("bot", StringComparison.Ordinal));
        return token < 0 || token == segments.Length - 1
            ? "(unknown)"
            : string.Join('/', segments[(token + 1)..]);
    }
}
