using Application.Translation.Pipeline;
using Infrastructure.Translation.Wiktionary;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Translation.Agent;

public static class TranslationAgentRegistration
{
    /// <summary>
    /// The model and tool side of <see cref="GeorgianTranslationPipeline"/>: the agents on Microsoft
    /// Agent Framework and the Wiktionary client. Nothing here talks to a model unless
    /// <c>TranslationAgent:Enabled</c> is true and a key and model ids are configured.
    /// </summary>
    public static IServiceCollection AddTranslationAgent(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<TranslationAgentOptions>(configuration.GetSection(TranslationAgentOptions.SectionName));

        services.AddSingleton<ITranslationChatClients, OpenAiTranslationChatClients>();
        services.AddScoped<ITranslationAgentSwitch, TranslationAgentSwitch>();
        services.AddScoped<ITranslationRequestClassifier, MafTranslationRequestClassifier>();
        services.AddScoped<IVerbAnalyst, MafVerbAnalyst>();
        services.AddScoped<IVerbGenerationSwitch, VerbGenerationSwitch>();
        services.AddScoped<IVerbGenerator, MafVerbGenerator>();
        services.AddScoped<IVerbReviewer, MafVerbReviewer>();

        services.AddSingleton<WiktionaryRateLimiter>();
        services.AddHttpClient(WiktionaryVerbSource.HttpClientName);
        services.AddScoped<IWiktionaryVerbSource, WiktionaryVerbSource>();
        return services;
    }
}
