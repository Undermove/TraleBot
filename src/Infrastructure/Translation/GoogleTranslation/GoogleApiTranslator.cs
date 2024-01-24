using System.Text;
using Google.Cloud.Translation.V2;
using Application.Common.Interfaces.TranslationService;
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
        var apiKey = Encoding.UTF8.GetString(data);
        _translationClient = TranslationClient.CreateFromApiKey(apiKey);
    }

    public async Task<TranslationResult> TranslateAsync(string? requestWord, Language language,
        CancellationToken ct)
    {
        if (requestWord is { Length: > 40 })
        {
            return new TranslationResult.PromptLengthExceeded();
        }
            
        var targetLanguage = GetLanguageCode(language);
            
        var response = await _translationClient.TranslateTextAsync(
            text: requestWord,
            targetLanguage: targetLanguage,
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
            _ => ""
        };
    }
}