using Application.Translation.Pipeline;
using FluentAssertions;
using Infrastructure.Translation.Agent;
using Infrastructure.Translation.OpenAiTranslation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace IntegrationTests.Translation;

/// <summary>
/// The agent path must be off unless it is explicitly switched on AND fully configured. Built from
/// configuration the way the application does it; no client created here ever sends a request.
/// </summary>
public class TranslationAgentSwitchTests
{
    private static bool IsOn(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var agent = new TranslationAgentOptions();
        configuration.GetSection(TranslationAgentOptions.SectionName).Bind(agent);
        var openAi = configuration.GetSection(OpenAiConfig.Name).Get<OpenAiConfig>();

        var clients = new OpenAiTranslationChatClients(Options.Create(openAi!), Options.Create(agent));
        return new TranslationAgentSwitch(Options.Create(agent), clients).IsOn;
    }

    private static Dictionary<string, string?> FullyConfigured() => new()
    {
        ["TranslationAgent:Enabled"] = "true",
        ["TranslationAgent:ClassifierModel"] = "small-model",
        ["TranslationAgent:AnalystModel"] = "strong-model",
        ["OpenAiConfiguration:ApiKey"] = "not-a-real-key"
    };

    [Test]
    public void On_when_enabled_with_a_key_and_both_models()
    {
        IsOn(FullyConfigured()).Should().BeTrue();
    }

    [Test]
    public void Off_by_default_with_nothing_configured()
    {
        IsOn(new Dictionary<string, string?>()).Should().BeFalse();
    }

    [Test]
    public void Off_when_a_key_and_models_are_there_but_the_switch_is_not()
    {
        var settings = FullyConfigured();
        settings.Remove("TranslationAgent:Enabled");

        IsOn(settings).Should().BeFalse(because: "prod already has an OpenAI key; having it must not turn the agent on");
    }

    [TestCase("OpenAiConfiguration:ApiKey")]
    [TestCase("TranslationAgent:ClassifierModel")]
    [TestCase("TranslationAgent:AnalystModel")]
    public void Off_when_switched_on_but_something_is_missing(string missing)
    {
        var settings = FullyConfigured();
        settings[missing] = "";

        IsOn(settings).Should().BeFalse();
    }
}
