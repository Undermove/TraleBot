using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using Application.Translation.Pipeline;
using Infrastructure.Translation.OpenAiTranslation;
using Microsoft.Extensions.Options;

namespace Infrastructure.Translation.Agent;

/// <summary>
/// The content check on the OpenAI Decisions API (<c>POST /v1/decisions</c>): one call, a few yes/no
/// questions about the text, each answered with a probability. Not a chat model, so not an
/// <c>IChatClient</c> and not an Agent Framework agent; the OpenAI package (2.14) has no client for it yet.
/// <para>
/// Each question is about one thing. Tried on 19.10.2026: one question "is this unacceptable — swearing
/// is fine though" scored 0.7–0.9 on everything, «виноград» included; separate one-thing questions
/// scored 0 or 1. The bare text «убей всех грузин» got the whole request refused; with the line that
/// says it is a user's input it got answered.
/// </para>
/// </summary>
public class OpenAiDecisionsContentGuard(
    IHttpClientFactory httpClientFactory,
    IOptions<OpenAiConfig> openAi,
    IOptions<TranslationAgentOptions> options) : IContentGuard
{
    public const string HttpClientName = "openai-decisions";

    private static readonly Uri Endpoint = new("https://api.openai.com/v1/decisions");

    /// <summary>Name → question. A name is what the log says the text was refused for.</summary>
    private static readonly (string Name, string Instructions)[] Questions =
    [
        ("minors", "The text sexualizes children."),
        ("violence", "The text threatens someone or calls for violence against people."),
        ("hate", "The text attacks a nationality, ethnicity, religion or other group."),
        ("generate", "The text asks the bot to write, generate or tell something (a story, a poem, a joke, an essay) instead of being a word or a phrase to translate."),
    ];

    public bool IsAvailable =>
        !string.IsNullOrWhiteSpace(openAi.Value?.ApiKey) && !string.IsNullOrWhiteSpace(options.Value.ContentGuardModel);

    public async Task<ContentVerdict> CheckAsync(string text, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["model"] = options.Value.ContentGuardModel,
            ["input"] = "Text a user typed into a Russian–Georgian translation bot: " + text,
            ["questions"] = new JsonArray(Questions
                .Select(q => (JsonNode)new JsonObject { ["type"] = "predicate", ["name"] = q.Name, ["instructions"] = q.Instructions })
                .ToArray()),
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", openAi.Value.ApiKey);
        request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");

        using var response = await httpClientFactory.CreateClient(HttpClientName).SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            throw new TranslationAgentException($"content check answered HTTP {(int)response.StatusCode}");
        }

        var json = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct));
        var answers = json?["answers"] as JsonArray ?? throw new TranslationAgentException("content check returned no answers");
        var reasons = new List<string>();
        foreach (var answer in answers.OfType<JsonObject>())
        {
            var name = answer["name"]?.GetValue<string>() ?? "?";
            var type = answer["type"]?.GetValue<string>();
            if (type == "refusal")
            {
                // The model would not even look at the text — that says enough about it.
                reasons.Add(name + ":refusal");
            }
            else if (answer["probability"]?.GetValue<double>() is { } probability && probability >= options.Value.ContentGuardThreshold)
            {
                reasons.Add(name + ":" + probability.ToString("0.00", CultureInfo.InvariantCulture));
            }
        }

        var inputTokens = json["usage"]?["input_tokens"]?.GetValue<long>() ?? 0;
        return new ContentVerdict(reasons.Count == 0 ? null : string.Join(", ", reasons), new ModelUsage(1, inputTokens, 0));
    }
}
