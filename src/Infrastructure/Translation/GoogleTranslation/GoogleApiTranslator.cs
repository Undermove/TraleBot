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
    private readonly TranslationClient _translationClient;

    public GoogleApiTranslator(IOptions<GoogleApiConfig> config)
    {
        var data = Convert.FromBase64String(config.Value.ApiKeyBase64);
        var credentialsJson = Encoding.UTF8.GetString(data);
        var credential = GoogleCredential.FromJson(credentialsJson);
        _translationClient = TranslationClient.Create(credential);
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

        var response = await _translationClient.TranslateTextAsync(
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