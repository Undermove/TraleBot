using Application.Translation.Pipeline;
using Infrastructure.Translation.OpenAiTranslation;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;

namespace Infrastructure.Translation.Agent;

/// <summary>
/// The models behind the two agents, as <see cref="IChatClient"/> — the seam where tests put a fake
/// and where another provider could be plugged in. A client is null when its role is not configured.
/// </summary>
public interface ITranslationChatClients
{
    /// <summary>The cheap small model.</summary>
    IChatClient? Classifier { get; }

    /// <summary>The stronger model that works with tools.</summary>
    IChatClient? Analyst { get; }
}

/// <summary>OpenAI models; ids come from <see cref="TranslationAgentOptions"/>, the key from the existing <see cref="OpenAiConfig"/>.</summary>
public class OpenAiTranslationChatClients : ITranslationChatClients
{
    private readonly Lazy<IChatClient?> _classifier;
    private readonly Lazy<IChatClient?> _analyst;

    public OpenAiTranslationChatClients(IOptions<OpenAiConfig> openAi, IOptions<TranslationAgentOptions> options)
    {
        // Created on first use and only when the agent path is on: with no key nothing here runs.
        _classifier = new Lazy<IChatClient?>(() => Create(openAi.Value?.ApiKey, options.Value.ClassifierModel));
        _analyst = new Lazy<IChatClient?>(() => Create(openAi.Value?.ApiKey, options.Value.AnalystModel));
    }

    public IChatClient? Classifier => _classifier.Value;
    public IChatClient? Analyst => _analyst.Value;

    private static IChatClient? Create(string? apiKey, string model)
    {
        return string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model)
            ? null
            // The Responses API: the current small models accept function tools together with reasoning
            // only there (Chat Completions answers HTTP 400). The SDK still marks its Responses client
            // "for evaluation" (OPENAI001) — a version bump of the OpenAI package may need a touch here.
#pragma warning disable OPENAI001
            : new OpenAIClient(apiKey).GetResponsesClient().AsIChatClient(model);
#pragma warning restore OPENAI001
    }
}

public class TranslationAgentSwitch(IOptions<TranslationAgentOptions> options, ITranslationChatClients clients)
    : ITranslationAgentSwitch
{
    public bool IsOn => options.Value.Enabled && clients.Classifier != null && clients.Analyst != null;
}
