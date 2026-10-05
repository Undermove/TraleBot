using System.Net;
using System.Text.Json;
using Application.Translation.Pipeline;
using Application.Verbs;
using Microsoft.Extensions.Options;

namespace Infrastructure.Translation.Wiktionary;

/// <summary>
/// Spaces out requests to Wiktionary for the whole process: however many users ask at once, the site
/// sees at most one request per interval from us.
/// </summary>
public class WiktionaryRateLimiter
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTime _nextAllowedUtc = DateTime.MinValue;

    public async Task WaitTurnAsync(TimeSpan minInterval, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var wait = _nextAllowedUtc - DateTime.UtcNow;
            if (wait > TimeSpan.Zero)
            {
                await Task.Delay(wait, ct);
            }

            _nextAllowedUtc = DateTime.UtcNow + minInterval;
        }
        finally
        {
            _gate.Release();
        }
    }
}

/// <summary>
/// HTTP client for the conjugation tables of the English Wiktionary (MediaWiki API, CC BY-SA 4.0):
/// identifies itself, keeps a minimum interval between requests, and retries a throttled or failed
/// attempt a couple of times with a growing pause.
/// </summary>
public class WiktionaryVerbSource(
    IHttpClientFactory httpClientFactory,
    WiktionaryRateLimiter rateLimiter,
    IOptions<TranslationAgentOptions> options) : IWiktionaryVerbSource
{
    public const string HttpClientName = "wiktionary";

    private const string Api = "https://en.wiktionary.org/w/api.php";
    private const string UserAgent = "TraleBotVerbs/0.1 (https://tralebot.com)";

    public async Task<WiktionaryVerbPage?> FetchAsync(string page, CancellationToken ct)
    {
        // Only a Georgian word can be a Georgian verb's page; the title comes from a model and is not
        // allowed to send us anywhere else.
        if (page.Length > VerbParadigm.MaxFormLength || !VerbParadigm.GeorgianWord.IsMatch(page))
        {
            return null;
        }

        var settings = options.Value;
        var url = $"{Api}?format=json&formatversion=2&action=parse&prop={Uri.EscapeDataString("text|revid|wikitext")}" +
                  $"&page={Uri.EscapeDataString(page)}";
        Exception? lastError = null;

        for (var attempt = 0; attempt <= settings.WiktionaryRetries; attempt++)
        {
            if (attempt > 0)
            {
                await Task.Delay(TimeSpan.FromMilliseconds((long)settings.WiktionaryRetryDelayMs * attempt), ct);
            }

            await rateLimiter.WaitTurnAsync(TimeSpan.FromMilliseconds(settings.WiktionaryMinIntervalMs), ct);
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, settings.WiktionaryTimeoutSeconds)));

                using var client = httpClientFactory.CreateClient(HttpClientName);
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
                using var response = await client.SendAsync(request, timeout.Token);
                if (response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500)
                {
                    lastError = new HttpRequestException($"Wiktionary answered {(int)response.StatusCode}");
                    continue;
                }

                var body = await response.Content.ReadAsStringAsync(timeout.Token);
                // The API answers JSON for a missing page as well; anything else is the throttling page.
                return WiktionaryVerbParser.Parse(body, page);
            }
            catch (Exception e) when (e is HttpRequestException or JsonException or OperationCanceledException
                                      && !ct.IsCancellationRequested)
            {
                lastError = e;
            }
        }

        throw new HttpRequestException($"Wiktionary is unavailable after {settings.WiktionaryRetries + 1} attempts", lastError);
    }
}
