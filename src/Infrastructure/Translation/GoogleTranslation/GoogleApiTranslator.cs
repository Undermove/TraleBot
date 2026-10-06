using System.Text;
using Application.Common.Extensions;
using Google.Cloud.Translation.V2;
using Application.Common.Interfaces.TranslationService;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Options;
using Language = Domain.Entities.Language;
using TranslationResult = Application.Common.Interfaces.TranslationService.TranslationResult;

namespace Infrastructure.Translation.GoogleTranslation;

public class GoogleApiTranslator : IGoogleApiTranslator
{
    // Built on first use, not in the constructor: every translation request constructs this class
    // (it is a dependency of the Georgian module), and missing or broken Google credentials must cost
    // only the Google fallback — not the whole translation.
    private readonly Lazy<TranslationClient?> _translationClient;

    public GoogleApiTranslator(IOptions<GoogleApiConfig> config)
    {
        _translationClient = new Lazy<TranslationClient?>(() => CreateClient(config.Value?.ApiKeyBase64));
    }

    private static TranslationClient? CreateClient(string? apiKeyBase64)
    {
        if (string.IsNullOrWhiteSpace(apiKeyBase64))
        {
            return null;
        }

        try
        {
            var credentialsJson = Encoding.UTF8.GetString(Convert.FromBase64String(apiKeyBase64));
            return TranslationClient.Create(GoogleCredential.FromJson(credentialsJson));
        }
        catch (Exception e) when (e is FormatException or InvalidOperationException or ArgumentException or System.Text.Json.JsonException or Newtonsoft.Json.JsonException)
        {
            return null;
        }
    }

    public async Task<TranslationResult> TranslateAsync(string requestWord, Language targetLanguage,
        CancellationToken ct)
    {
        if (requestWord is { Length: > 40 })
        {
            return new TranslationResult.PromptLengthExceeded();
        }

        var targetLanguageCode = requestWord.DetectLanguage() == Language.Russian
            ? GetLanguageCode(targetLanguage)
            : LanguageCodes.Russian;

        var client = _translationClient.Value;
        if (client == null)
        {
            // Not configured: this translator has nothing to say, the caller reports "no translation".
            return new TranslationResult.Failure();
        }

        var response = await client.TranslateTextAsync(
            text: requestWord,
            targetLanguage: targetLanguageCode,
            cancellationToken: ct
        );

        if (response == null)
        {
            return new TranslationResult.Failure();
        }

        // Create a TranslationResult object based on the response from the API
        return new TranslationResult.Success(
            response.TranslatedText,
            "",
            ""
        );
    }

    private static string GetLanguageCode(Language language)
    {
        return language switch
        {
            Language.English => LanguageCodes.English,
            Language.Georgian => LanguageCodes.Georgian,
            Language.Russian => LanguageCodes.Russian,
            _ => ""
        };
    }
}