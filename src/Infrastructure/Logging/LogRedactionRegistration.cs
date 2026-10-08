using Infrastructure.Telegram;
using Infrastructure.Translation.GoogleTranslation;
using Infrastructure.Translation.OpenAiTranslation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Logging;

public static class LogRedactionRegistration
{
    /// <summary>
    /// Puts <see cref="RedactingLoggerFactory"/> in front of all log providers. The secrets are read
    /// when the first logger is created, from the same objects the application itself uses.
    /// </summary>
    public static IServiceCollection AddLogSecretRedaction(this IServiceCollection services)
    {
        services.AddLogging();
        services.Replace(ServiceDescriptor.Singleton<ILoggerFactory>(provider =>
        {
            // The framework's own factory, built the way AddLogging() builds it.
            var factory = new LoggerFactory(
                provider.GetServices<ILoggerProvider>(),
                provider.GetRequiredService<IOptionsMonitor<LoggerFilterOptions>>(),
                provider.GetRequiredService<IOptions<LoggerFactoryOptions>>(),
                provider.GetService<IExternalScopeProvider>());

            var redactor = new SecretRedactor(LogSecrets.Collect(
                provider.GetService<BotConfiguration>(),
                provider.GetService<IOptions<OpenAiConfig>>()?.Value,
                provider.GetService<IOptions<GoogleApiConfig>>()?.Value,
                provider.GetService<IConfiguration>()?.GetSection("ConnectionStrings").GetChildren().Select(c => c.Value) ?? []));

            return redactor.HasSecrets ? new RedactingLoggerFactory(factory, redactor) : factory;
        }));
        return services;
    }
}
